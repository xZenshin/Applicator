/** An error whose message is meant for the user; `kind` lets the UI react to specific cases. */
export class AppError extends Error {
  constructor(
    readonly kind: string,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}
