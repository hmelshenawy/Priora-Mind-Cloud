import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseClient, createClient, } from "@supabase/supabase-js";

@Injectable()
export class StorageService {
    private readonly supabase: SupabaseClient;
    private readonly bucket: string;
    constructor(
        private readonly config: ConfigService,
    ) {
        this.supabase = createClient(this.config.getOrThrow("SUPABASE_URL"), this.config.getOrThrow("SUPABASE_SECRET_KEY"))
        this.bucket = "files"
    }

    async upload(file: Express.Multer.File, storageKey: string) {
        console.log("upload multer file", file)
        console.log("upload multer storage", storageKey)

        const result = await this.supabase.storage
            .from(this.bucket)
            .upload(storageKey, file.buffer, {
                contentType: file.mimetype,
            });

        if (result.error || !result.data?.path) {
            throw new BadRequestException("Failed !!")
        }

        return result.data.path
    }

    async delete(storageKey: string) {
        const result = await this.supabase.storage
            .from(this.bucket).remove([storageKey])

        if (result.error) {
            throw new BadRequestException("Failed!!")
        }
        return result
    }
}