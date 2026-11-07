import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, RequestTimeoutException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";



@Injectable()
export class RagService {
    constructor(
        private readonly configs: ConfigService,
    ) { }
    async ingest(storageKey: string, source_id: string, mindSpaceId: string, fileName: string, requestId: string = randomUUID()) {
        const baseUrl = this.configs.getOrThrow("RAG_URL")
        const ragSecretKey = this.configs.getOrThrow<string>("RAG_SECRET_KEY");
        const url = baseUrl + "/v1/ingest"
        try {
            const ingest = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Internal-Service-Key": ragSecretKey,
                    "X-Request-ID": requestId,
                },
                body: JSON.stringify({
                    storageKey,
                    source_id,
                    mindSpaceId,
                    fileName
                }),
                signal: AbortSignal.timeout(600000)
            },
            )

            if (!ingest.ok) {
                throw new BadRequestException("RAG Failed!")
            }
            else return ingest.json()

        } catch (error) {
            if (error instanceof DOMException && error.name === "TimeoutError") {
                throw new RequestTimeoutException("RAG ingestion timed out")
            }
            throw error
        }
    }
}