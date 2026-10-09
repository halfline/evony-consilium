export class OperationCancelled extends Error {
  constructor(message = "Operation cancelled.") {
    super(message);
  }
}
