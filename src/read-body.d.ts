import type {IncomingMessage} from 'node:http';

/**
 * Consume a Node request stream, enforce a byte-size cap, parse as JSON.
 *
 * Resolves to the parsed JSON value, or `null` when the body is empty.
 * Rejects with `status: 413 / code: PayloadTooLarge` once accumulated bytes
 * exceed `maxBodyBytes`, or `status: 400 / code: BadJsonBody` on invalid
 * JSON. The request is destroyed on cap violation.
 *
 * @param req A readable request stream (duck-typed on `on('data'|'end'|'error')`).
 * @param maxBodyBytes Hard cap; bodies above this size are rejected.
 * @returns Parsed JSON, or `null` for empty bodies.
 */
export function readJsonBody(req: IncomingMessage, maxBodyBytes: number): Promise<unknown>;
