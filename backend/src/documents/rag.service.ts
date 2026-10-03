import { BadRequestException, Injectable, RequestTimeoutException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";



@Injectable()
export class RagService {
    constructor(
        private readonly configs: ConfigService,
    ){}
    async ingest(storageKey: string, source_id: string, mindSpaceId: string) {
        const baseUrl= this.configs.getOrThrow("RAG_URL")
        const url = baseUrl+"/v1/ingest"
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