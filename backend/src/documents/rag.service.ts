import { BadRequestException, Injectable, RequestTimeoutException } from "@nestjs/common";
import { json } from "stream/consumers";


@Injectable()
export class RagService {
    async ingest(storageKey: string, source_id: string, mindSpaceId: string) {

        const url = "http://localhost:8800/v1/ingest"
        try {
            const ingest = await fetch(url, {
                method: "POST",
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({
                    storageKey,
                    source_id,
                    mindSpaceId,
                }),
                signal: AbortSignal.timeout(120000)
            },
            )

            if (!ingest.ok) {
                throw new BadRequestException("RAG Failed!")
            }
            else return ingest.json()

        } catch (error) {
            if (error instanceof DOMException && error.name === "TimeoutError") {
                console.log(error)
                throw new RequestTimeoutException("RAG ingestion timed out")
            }
            throw error
        }
    }
}