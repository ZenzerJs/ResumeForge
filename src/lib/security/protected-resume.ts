export class ProtectedResumeError extends Error {
  constructor(
    message = "Protected master resume cannot be updated via this endpoint. Use Save as Master."
  ) {
    super(message);
    this.name = "ProtectedResumeError";
  }
}
