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
    const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .upload(storageKey, file.buffer, {
            contentType: file.mimetype,
        });

    if (error) {
        console.error("Supabase Storage Error:", {
            name: error.name,
            message: error.message,
            statusCode: error.statusCode,
        });

        throw new BadRequestException("Storage upload failed");
    }

    if (!data?.path) {
        throw new BadRequestException("Storage returned no file path");
    }

    return data.path;
}

    async delete(storageKey: string) {
        const result = await this.supabase.storage
            .from(this.bucket).remove([storageKey])

        if (result.error) {
            throw new BadRequestException("Failed!!")
        }
        return result
    }

    async getSignedUrl(storageKey: string): Promise<string> {
        const { data, error } = await this.supabase.storage
            .from(this.bucket)
            .createSignedUrl(storageKey, 60 * 60 * 24* 10);

        if (error || !data?.signedUrl) {
            throw new BadRequestException(
                "Failed to generate download URL"
            );
        }

        return data.signedUrl;
    }
}