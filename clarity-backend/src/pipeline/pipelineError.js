export class PipelineError extends Error {
  constructor(stageName, cause) {
    super(`Pipeline stage '${stageName}' failed: ${cause.message}`);
    this.name = 'PipelineError';
    this.stageName = stageName;
    this.cause = cause;
  }
}
