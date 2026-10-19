import { ApiError, type UploadResult, type UploadProgress } from "./types";
import { getToken } from "./auth";
export const MAX_ZIP_BYTES = 512 * 1024 * 1024;
export function validateUpload(
  file: Pick<File, "name" | "size">,
): "upload.zipOnly" | "upload.tooLarge" | null {
  if (!file.name.toLowerCase().endsWith(".zip")) return "upload.zipOnly";
  return file.size > MAX_ZIP_BYTES ? "upload.tooLarge" : null;
}
export function uploadCourseFile(
  file: File,
  onProgress?: (state: UploadProgress) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/dev/courses/upload/");
    xhr.timeout = 30 * 60 * 1000;
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Token ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.({
          phase: "uploading",
          percent: Math.round((event.loaded / event.total) * 100),
        });
    };
    xhr.upload.onload = () =>
      onProgress?.({ phase: "processing", percent: 100 });
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* Proxy errors can be HTML. */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body)
        resolve(body as UploadResult);
      else reject(new ApiError(xhr.status, "Upload failed", body));
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error"));
    xhr.ontimeout = () => reject(new ApiError(408, "Upload timed out"));
    xhr.onabort = () => reject(new ApiError(0, "Upload interrupted"));
    const form = new FormData();
    form.append("file", file);
    onProgress?.({ phase: "uploading", percent: 0 });
    xhr.send(form);
  });
}
