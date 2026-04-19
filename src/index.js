// dynamodb-toolkit Express adapter — main entry.
// Translates Express (req, res, next) into rest-core parsers + matchRoute + standard route pack.
//
// Design outline (to implement):
//   createExpressAdapter(adapter, options?) → Express middleware (req, res, next) => void
//     - parse req.method + req.path via matchRoute
//     - drive req.body (populated by express.json()) and req.query through rest-core parsers
//     - dispatch to the supplied dynamodb-toolkit Adapter
//     - write response via res.status(N).json(body) / res.status(N).end() using rest-core builders + policy
//
// Reference: dynamodb-toolkit-koa@0.1.0 src/index.js — structurally parallel,
// same matchRoute / rest-core plumbing, different req/res shim.
