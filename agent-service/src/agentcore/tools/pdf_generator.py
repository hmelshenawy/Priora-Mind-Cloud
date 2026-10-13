"""Markdown -> PDF generator for Priora Mind Cloud.

Install: pip install reportlab markdown-it-py

MVP: English/Latin Markdown headings, paragraphs, bullet/numbered lists,
blockquotes, basic inline formatting, tables, horizontal rules and page numbers.
Arabic/RTL, images and nested tables are not supported yet.
"""

from __future__ import annotations
import httpx
from agentcore.config import Configs
from dataclasses import dataclass
from html import escape
from pathlib import Path
import re
from uuid import uuid4
from io import BytesIO
from markdown_it import MarkdownIt
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)
from agentcore.context import mindSpaceId, access_token
from agentcore.tools.tools import available_tools, tools_registery


@dataclass(frozen=True)
class PDFResult:
    file_id: str
    filename: str
    path: str


class PDFGenerator:
    def __init__(self, output_dir: str | Path = "generated_pdfs") -> None:
        # self.output_dir = Path(output_dir)
        # self.output_dir.mkdir(parents=True, exist_ok=True)
        self.parser = MarkdownIt("commonmark").enable("table")
        self.styles = self._build_styles()

    def generate(self, *, title: str, content: str, filename: str | None = None) -> PDFResult:
        buffer = BytesIO()

        if not title.strip() or not content.strip():
            raise ValueError("title and content are required")

        # file_id = uuid4().hex
        # safe_name = self._safe_filename(filename or title)
        # # Unique filename prevents overwrites; no LLM-provided filesystem paths.
        # stored_name = f"{file_id}_{safe_name}"
        # path = self.output_dir / stored_name

        document = SimpleDocTemplate(
            buffer, pagesize=A4,
            rightMargin=20 * mm, leftMargin=20 * mm,
            topMargin=22 * mm, bottomMargin=22 * mm,
            title=title, author="Priora Mind Cloud",
        )
        story = [Paragraph(escape(title), self.styles["DocumentTitle"]), Spacer(1, 5 * mm)]
        tokens = self.parser.parse(content)
        story.extend(self._render_tokens(tokens))
        document.build(story, onFirstPage=self._draw_footer, onLaterPages=self._draw_footer)
        return buffer.getvalue()

    def _build_styles(self) -> dict[str, ParagraphStyle]:
        base = getSampleStyleSheet()
        styles = {
            "DocumentTitle": ParagraphStyle("PMTitle", parent=base["Title"], fontSize=21, leading=27, spaceAfter=12, textColor=colors.HexColor("#16263D")),
            "Body": ParagraphStyle("PMBody", parent=base["BodyText"], fontSize=10, leading=15, spaceAfter=8, textColor=colors.HexColor("#283447")),
            "Quote": ParagraphStyle("PMQuote", parent=base["BodyText"], leftIndent=10, textColor=colors.HexColor("#566477"), spaceAfter=8),
            "TableCell": ParagraphStyle("PMCell", parent=base["BodyText"], fontSize=9, leading=12),
        }
        for level, size in ((1, 17), (2, 14), (3, 12), (4, 11), (5, 10), (6, 10)):
            styles[f"H{level}"] = ParagraphStyle(
                f"PMH{level}", parent=base["Heading2"], fontSize=size,
                leading=size + 4, spaceBefore=12, spaceAfter=6,
                textColor=colors.HexColor("#16263D"), keepWithNext=True,
            )
        return styles

    def _render_tokens(self, tokens: list) -> list:
        story = []
        list_stack: list[dict] = []
        quote_depth = 0
        i = 0
        while i < len(tokens):
            tok = tokens[i]
            typ = tok.type
            if typ in ("bullet_list_open", "ordered_list_open"):
                number = int(tok.attrGet("start") or 1) if typ == "ordered_list_open" else None
                list_stack.append({"ordered": typ == "ordered_list_open", "number": number})
            elif typ in ("bullet_list_close", "ordered_list_close"):
                list_stack.pop()
            elif typ == "blockquote_open":
                quote_depth += 1
            elif typ == "blockquote_close":
                 quote_depth -= 1
            elif typ == "heading_open":
                level = int(tok.tag[1])
                inline = tokens[i + 1]
                story.append(Paragraph(self._inline_markup(inline.children or []), self.styles[f"H{level}"]))
                i += 2  # skip inline and heading_close
            elif typ == "paragraph_open":
                inline = tokens[i + 1]
                txt = self._inline_markup(inline.children or [])
                if list_stack:
                    current = list_stack[-1]
                    marker = f"{current['number']}." if current["ordered"] else "•"
                    if current["ordered"]:
                        current["number"] += 1
                    indent = 11 * len(list_stack)
                    style = ParagraphStyle(
                        "ListItemDynamic", parent=self.styles["Body"],
                        leftIndent=indent + 12, firstLineIndent=-12, spaceAfter=4,
                    )
                    story.append(Paragraph(f"{escape(marker)}  {txt}", style))
                else:
                    story.append(Paragraph(txt, self.styles["Quote"] if quote_depth else self.styles["Body"]))
                i += 2  # skip inline and paragraph_close
            elif typ == "table_open":
                table, closing_index = self._render_table(tokens, i)
                story.append(table)
                story.append(Spacer(1, 4 * mm))
                i = closing_index
            elif typ == "hr":
                story.append(Spacer(1, 3 * mm))
                story.append(HRFlowable(width="100%", color=colors.HexColor("#D7DDE6")))
                story.append(Spacer(1, 3 * mm))
            elif typ == "fence" or typ == "code_block":
                for line in tok.content.rstrip("\n").split("\n"):
                    story.append(Paragraph(f"<font face='Courier'>{escape(line) or '&nbsp;'}</font>", self.styles["Body"]))
            i += 1
        return story

    def _render_table(self, tokens: list, start: int) -> tuple[Table, int]:
        data: list[list] = []
        row: list = []
        i = start + 1
        while i < len(tokens) and tokens[i].type != "table_close":
            tok = tokens[i]
            if tok.type == "tr_open":
                row = []
            elif tok.type in ("th_open", "td_open"):
                inline = tokens[i + 1]
                row.append(Paragraph(self._inline_markup(inline.children or []), self.styles["TableCell"]))
            elif tok.type == "tr_close":
                data.append(row)
            i += 1
        if not data:
            raise ValueError("Empty Markdown table")
        width = A4[0] - 40 * mm
        column_count = max(len(r) for r in data)
        for row in data:
            row.extend([""] * (column_count - len(row)))
        table = Table(data, colWidths=[width / column_count] * column_count, repeatRows=1, hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAF0F7")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        return table, i

    @staticmethod
    def _inline_markup(children: list) -> str:
        output = []
        for token in children:
            typ = token.type
            if typ == "text":
                output.append(escape(token.content))
            elif typ == "softbreak":
                output.append(" ")
            elif typ == "hardbreak":
                output.append("<br/>")
            elif typ == "strong_open":
                output.append("<b>")
            elif typ == "strong_close":
                output.append("</b>")
            elif typ == "em_open":
                output.append("<i>")
            elif typ == "em_close":
                output.append("</i>")
            elif typ == "code_inline":
                output.append(f"<font face='Courier'>{escape(token.content)}</font>")
            elif typ == "link_open":
                href = token.attrGet("href") or ""
                if href.lower().startswith(("https://", "http://")):
                    output.append(f'<link href="{escape(href, quote=True)}" color="#215AA8">')
                else:
                    output.append("")
            elif typ == "link_close":
                # Only close a link opened above (MarkdownIt validates paired tokens).
                output.append("</link>" if any(x.startswith("<link ") for x in output) else "")
            elif typ == "image":
                output.append(escape(token.content or "[image]"))
        return "".join(output)

    @staticmethod
    def _safe_filename(name: str) -> str:
        stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(name).stem).strip("-_")[:70]
        return f"{stem or 'report'}.pdf"

    @staticmethod
    def _draw_footer(canvas, document) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#718096"))
        canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f"Page {document.page}")
        canvas.restoreState()


# -----------------------PDF-GENERATOR-CLASS-END------------------------------------

pdf_generator = PDFGenerator()


async def generate_pdf(
    title: str,
    content: str,
    filename: str | None = None
):
    """
    Generate a PDF document from Markdown and upload
    it to cloud storage.

    Use this tool when the user requests a PDF document,
    report, summary, or other downloadable PDF file.

    Args:
        title: Main document title, rendered automatically.

        content: Markdown body only. Do not repeat the
            document title or include a top-level H1.
            Start sections with H2 (##).

        filename: Optional PDF filename.

    Returns:
        A dictionary containing:
        - filename: The generated PDF filename.
        - downloadUrl: The URL to download the PDF.

    IMPORTANT:
        After successful execution, include downloadUrl
        in your final response as a Markdown link:

        [Download filename](downloadUrl)

        Use the exact URL returned by the tool.
        Never invent or modify the URL.

        Do not simply say the file was generated.
        Always provide the download link.
        """

    pdf_bytes = pdf_generator.generate(
        title=title,
        content=content,
        filename=filename
    )

    safe_filename = pdf_generator._safe_filename(
        filename or title
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{Configs.BACKEND_SERVICE_URL}/documents/generated",
            headers={
                "Authorization": f"Bearer {access_token.get()}"
            },
            files={
                "file": (
                    safe_filename,
                    pdf_bytes,
                    "application/pdf"
                )
            }
        )

    response.raise_for_status()
    return response.json()


available_tools.append(generate_pdf)
tools_registery[generate_pdf.__name__] = generate_pdf


