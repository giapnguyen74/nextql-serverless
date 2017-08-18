"use strict";
function create_openwhisk_invoker() {
	var openwhisk = require("openwhisk");
	var ow = openwhisk();
	return function(name, params) {
		return ow.actions
			.invoke({
				actionName: name,
				params: params,
				result: true,
				blocking: true
			})
			.then(
				res =>
					res.response.success
						? res.response.result
						: Promise.reject(res.response)
			);
	};
}

module.exports = {
	install(nextql, config) {
		config = Object.assign({ type: "openwhisk" }, config);

		let invoker = () => Promise.reject("Unsupported serverless type");

		if (config.type == "openwhisk") {
			invoker = create_openwhisk_invoker();
		}

		nextql.beforeCreate(options => {
			if (options.serverless) {
				options.methods = Object.assign({}, options.methods);
				options.computed = Object.assign({}, options.computed);
				options.returns = Object.assign({}, options.returns);
				const actions = options.serverless.actions || {};
				Object.keys(actions).forEach(k => {
					if (!actions[k].name) {
						throw new Error(`Action ${k} missing name`);
					}
					options.methods[k] = function(params, context) {
						return invoker(actions[k].name, { params });
					};
					options.returns[k] = actions[k].model
						? actions[k].model
						: options.name;
				});

				const computed = options.serverless.computed || {};
				Object.keys(computed).forEach(k => {
					if (!computed[k].name) {
						throw new Error(`Computed ${k} missing name`);
					}

					options.computed[k] = function(source, params, context) {
						return invoker(computed[k].name, { source, params });
					};
					if (computed[k].model) {
						options.fields[k] = computed[k].model;
					}
				});
			}
		});
	}
};
