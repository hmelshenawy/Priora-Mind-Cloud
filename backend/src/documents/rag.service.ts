import { BadRequestException, Injectable } from "@nestjs/common";
import { json } from "stream/consumers";


@Injectable()
export class RagService {
    async ingest(storageKey: string, source_id: string, mindSpaceId: string) {

        const url = "http://localhost:8800/v1/ingest"

        const ingest = await fetch(url, {
            method: "POST",
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({
                storageKey,
                source_id,
                mindSpaceId,
            })
        })

        if(!ingest.ok){
            throw new BadRequestException("RAG Failed!")
        }

        else return ingest.json()
    }


}