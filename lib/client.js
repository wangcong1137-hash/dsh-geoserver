window.__ModuleLoader__.load({
	id: "dsh-geoserver",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region \0dsh-css:D:\code\dsh-geoserver\src\client\fields.module.css.mjs
		const css$1 = ".-nMMka_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.-nMMka_field+.-nMMka_field{border-top:1px solid var(--dsw-alias-border-l2)}.-nMMka_head{align-items:center;gap:8px;display:flex}.-nMMka_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.-nMMka_badges{align-items:center;gap:8px;display:inline-flex}.-nMMka_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.-nMMka_badgeMuted{white-space:nowrap;color:var(--dsw-alias-label-tertiary);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px}.-nMMka_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.-nMMka_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.-nMMka_reset:disabled{cursor:default}.-nMMka_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.-nMMka_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.-nMMka_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.-nMMka_inputInvalid{border-color:var(--dsw-alias-label-error);}.-nMMka_textarea{resize:vertical;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);min-height:74px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:8px 12px;font-size:13px;line-height:1.5}.-nMMka_textarea:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.-nMMka_textarea:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.-nMMka_textareaInvalid{border-color:var(--dsw-alias-label-error);}.-nMMka_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.-nMMka_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}";
		const tagId$1 = "dsh-geoserver/client/fields.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-geoserver";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var fields_module_css_default = {
			"badge": "-nMMka_badge",
			"badgeMuted": "-nMMka_badgeMuted",
			"badges": "-nMMka_badges",
			"field": "-nMMka_field",
			"head": "-nMMka_head",
			"hint": "-nMMka_hint",
			"input": "-nMMka_input",
			"inputInvalid": "-nMMka_inputInvalid",
			"invalid": "-nMMka_invalid",
			"label": "-nMMka_label",
			"reset": "-nMMka_reset",
			"textarea": "-nMMka_textarea",
			"textareaInvalid": "-nMMka_textareaInvalid"
		};
		//#endregion
		//#region src/client/fields.tsx
		/**
		* Hand-written controls for the plugin configuration forms. Each renders one
		* field's label, its staged text, whether saving would leave an override, and
		* — when one stands — the reset that stages a clear back to the composition
		* layer. Nothing here writes: a control reports what the user typed, and the
		* card's save is the single point where a draft becomes a document mutation.
		*/
		/**
		* A staged value field. `numeric` only hints the keypad: which drafts a field
		* accepts is decided by its spec, so the control never silently rewrites what
		* the user typed.
		* @param props - the field's copy, its staged text, and the edit actions.
		* @returns the labelled control.
		*/
		function ValueField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: fields_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: fields_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: fields_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: fields_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: fields_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: fields_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						id: props.id,
						className: props.invalid ? fields_module_css_default.inputInvalid : fields_module_css_default.input,
						type: "text",
						...props.numeric === true ? { inputMode: "numeric" } : {},
						...props.invalid ? { "aria-invalid": true } : {},
						value: props.text,
						placeholder: props.placeholder ?? "",
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: props.invalid ? fields_module_css_default.invalid : fields_module_css_default.hint,
						children: props.invalid ? props.invalidLabel : props.hint
					})
				]
			});
		}
		/**
		* A staged multi-line value field.
		* @param props - the field's copy, its staged text, and the edit actions.
		* @returns the labelled text area.
		*/
		function TextAreaField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: fields_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: fields_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: fields_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: fields_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: fields_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: fields_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						id: props.id,
						className: props.invalid ? fields_module_css_default.textareaInvalid : fields_module_css_default.textarea,
						...props.invalid ? { "aria-invalid": true } : {},
						value: props.text,
						placeholder: props.placeholder ?? "",
						disabled: props.disabled,
						rows: 3,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: props.invalid ? fields_module_css_default.invalid : fields_module_css_default.hint,
						children: props.invalid ? props.invalidLabel : props.hint
					})
				]
			});
		}
		/**
		* A write-only credential control. The value never rides a response, so the
		* control reports only whether one is configured and starts blank; a blank
		* draft writes nothing, which keeps the stored key rather than clearing it.
		* @param props - the field's copy, its staged text, and the configured state.
		* @returns the labelled control.
		*/
		function SecretField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: fields_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: fields_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: fields_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: fields_module_css_default.badges,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: props.configured ? fields_module_css_default.badge : fields_module_css_default.badgeMuted,
								children: props.stateLabel
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						id: props.id,
						className: fields_module_css_default.input,
						type: "password",
						autoComplete: "off",
						value: props.text,
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: fields_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		//#endregion
		//#region ../deepseek/node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:D:\code\dsh-geoserver\src\client\PluginCard.module.css.mjs
		const css = ".q9B_ea_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.q9B_ea_card:hover{border-color:var(--dsw-alias-label-dimmed)}.q9B_ea_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.q9B_ea_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.q9B_ea_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.q9B_ea_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.q9B_ea_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.q9B_ea_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.q9B_ea_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.q9B_ea_chevronOpen{transform:rotate(180deg)}.q9B_ea_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.q9B_ea_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}.q9B_ea_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.q9B_ea_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.q9B_ea_failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}.q9B_ea_discard,.q9B_ea_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.q9B_ea_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.q9B_ea_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.q9B_ea_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.q9B_ea_discard:disabled,.q9B_ea_save:disabled{opacity:.4;cursor:default}.q9B_ea_discard:focus-visible,.q9B_ea_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId = "dsh-geoserver/client/PluginCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-geoserver";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PluginCard_module_css_default = {
			"body": "q9B_ea_body",
			"card": "q9B_ea_card",
			"cardOpen": "q9B_ea_cardOpen",
			"chevron": "q9B_ea_chevron",
			"chevronOpen": "q9B_ea_chevronOpen",
			"description": "q9B_ea_description",
			"discard": "q9B_ea_discard",
			"failed": "q9B_ea_failed",
			"footer": "q9B_ea_footer",
			"header": "q9B_ea_header",
			"headText": "q9B_ea_headText",
			"name": "q9B_ea_name",
			"pending": "q9B_ea_pending",
			"readOnly": "q9B_ea_readOnly",
			"save": "q9B_ea_save"
		};
		//#endregion
		//#region src/client/PluginCard.tsx
		/**
		* One plugin's card: a header naming the plugin and what its settings govern,
		* disclosing that plugin's controls in place, with the save that writes them.
		*
		* The header is its own button rather than a shared disclosure row because a
		* card stacks its name over its description, while that row lays the two side
		* by side — the layout, not the behavior, is what differs. Disclosure is
		* card-local state: which card a user has open is a reading gesture, not
		* something the Host or the section has any stake in. Staged edits outlive
		* collapsing, so the header marks a card holding unsaved edits.
		*
		* A card renders nothing while its namespace is unavailable: a deployment that
		* does not compose the owning plugin should show no trace of it, rather than a
		* disabled card the user cannot act on.
		*/
		/**
		* Render one plugin card.
		* @param props - the plugin's copy keys, its form state, and its controls.
		* @returns the card, or nothing when the namespace is unavailable.
		*/
		function PluginCard(props) {
			const [open, setOpen] = (0, react.useState)(false);
			const { state } = props;
			if (!state.available) return null;
			const title = props.t(props.titleKey);
			const blocked = !state.dirty || state.invalid || state.saving;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: clsx(PluginCard_module_css_default.card, open && PluginCard_module_css_default.cardOpen),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: PluginCard_module_css_default.header,
					"aria-expanded": open,
					"aria-label": `${props.t(open ? "collapse" : "expand")}: ${title}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: PluginCard_module_css_default.headText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: PluginCard_module_css_default.name,
								children: title
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: PluginCard_module_css_default.description,
								children: props.t(props.descriptionKey)
							})]
						}),
						state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: PluginCard_module_css_default.pending,
							children: props.t("unsaved")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: clsx(PluginCard_module_css_default.chevron, open && PluginCard_module_css_default.chevronOpen) })
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: PluginCard_module_css_default.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: PluginCard_module_css_default.readOnly,
							role: "status",
							children: props.t("readOnly")
						}) : null,
						props.children,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: PluginCard_module_css_default.footer,
							children: [
								state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: PluginCard_module_css_default.failed,
									role: "status",
									children: props.t("saveFailed")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: PluginCard_module_css_default.discard,
									disabled: !state.dirty || state.saving,
									onClick: props.onDiscard,
									children: props.t("discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: PluginCard_module_css_default.save,
									disabled: blocked,
									onClick: props.onSave,
									children: props.t(state.saving ? "saving" : "save")
								})
							]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/GeoserverCard.tsx
		/**
		* Render the GeoServer card.
		* @param props - locale copy, the card snapshot, and its form actions.
		* @returns the card.
		*/
		function GeoserverCard(props) {
			const { t } = props;
			const state = props.useGeoserverCard((snapshot) => snapshot);
			const disabled = !state.writable;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PluginCard, {
				t,
				titleKey: "geoserverTitle",
				descriptionKey: "geoserverDescription",
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "plugin-config-geoserver-base-url",
						label: t("geoserverBaseUrl"),
						hint: t("geoserverBaseUrlHint"),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalidNumber"),
						disabled,
						...state.baseUrl,
						onEdit: (text) => {
							props.edit("baseUrl", text);
						},
						onReset: () => {
							props.resetField("baseUrl");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "plugin-config-geoserver-username",
						label: t("geoserverUsername"),
						hint: t("geoserverUsernameHint"),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalidNumber"),
						disabled,
						...state.username,
						onEdit: (text) => {
							props.edit("username", text);
						},
						onReset: () => {
							props.resetField("username");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecretField, {
						id: "plugin-config-geoserver-password",
						label: t("geoserverPassword"),
						hint: t("geoserverPasswordHint"),
						disabled: !state.passwordWritable,
						text: state.password.text,
						configured: state.passwordConfigured,
						stateLabel: state.passwordConfigured ? t("geoserverPasswordSet") : t("geoserverPasswordUnset"),
						onEdit: (text) => {
							props.edit("password", text);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextAreaField, {
						id: "plugin-config-geoserver-publish-roots",
						label: t("geoserverPublishRoots"),
						hint: t("geoserverPublishRootsHint"),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalidNumber"),
						disabled,
						...state.publishRoots,
						onEdit: (text) => {
							props.edit("publishRoots", text);
						},
						onReset: () => {
							props.resetField("publishRoots");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "plugin-config-geoserver-default-workspace",
						label: t("geoserverDefaultWorkspace"),
						hint: t("geoserverDefaultWorkspaceHint"),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalidNumber"),
						disabled,
						...state.defaultWorkspace,
						onEdit: (text) => {
							props.edit("defaultWorkspace", text);
						},
						onReset: () => {
							props.resetField("defaultWorkspace");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "plugin-config-geoserver-publish-max-bytes",
						label: t("geoserverPublishMaxBytes"),
						hint: t("geoserverPublishMaxBytesHint"),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalidPositiveInteger"),
						disabled,
						numeric: true,
						...state.publishMaxBytes,
						onEdit: (text) => {
							props.edit("publishMaxBytes", text);
						},
						onReset: () => {
							props.resetField("publishMaxBytes");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "plugin-config-geoserver-webhook-url",
						label: t("geoserverWebhookUrl"),
						hint: t("geoserverWebhookUrlHint"),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalidNumber"),
						disabled,
						...state.webhookUrl,
						onEdit: (text) => {
							props.edit("webhookUrl", text);
						},
						onReset: () => {
							props.resetField("webhookUrl");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "plugin-config-geoserver-webhook-token-env",
						label: t("geoserverWebhookTokenEnv"),
						hint: t("geoserverWebhookTokenEnvHint"),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalidNumber"),
						disabled,
						...state.webhookTokenEnv,
						onEdit: (text) => {
							props.edit("webhookTokenEnv", text);
						},
						onReset: () => {
							props.resetField("webhookTokenEnv");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "plugin-config-geoserver-webhook-timeout-ms",
						label: t("geoserverWebhookTimeoutMs"),
						hint: t("geoserverWebhookTimeoutMsHint"),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalidPositiveInteger"),
						disabled,
						numeric: true,
						...state.webhookTimeoutMs,
						onEdit: (text) => {
							props.edit("webhookTimeoutMs", text);
						},
						onReset: () => {
							props.resetField("webhookTimeoutMs");
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/card-form.ts
		/**
		* A positive whole-number field. An empty draft clears the field; zero,
		* fractions, negative values, and non-numeric drafts block the save.
		* @param field - field name inside the namespace section.
		* @returns the field's conversion spec.
		*/
		function positiveIntegerField(field) {
			return {
				field,
				format: (value) => typeof value === "number" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					const parsed = Number(trimmed);
					return Number.isSafeInteger(parsed) && parsed > 0 ? {
						kind: "set",
						value: parsed
					} : void 0;
				}
			};
		}
		/**
		* A string-list field rendered as one trimmed item per line. Blank lines are
		* ignored, and an empty draft clears the field back to its default.
		* @param field - field name inside the namespace section.
		* @returns the field's conversion spec.
		*/
		function lineListField(field) {
			return {
				field,
				format: (value) => Array.isArray(value) && value.every((item) => typeof item === "string") ? value.join("\n") : "",
				parse: (text) => {
					const values = text.split(/\r?\n/u).map((value) => value.trim()).filter((value) => value.length > 0);
					return values.length === 0 ? { kind: "clear" } : {
						kind: "set",
						value: values
					};
				}
			};
		}
		/**
		* A free-text field. An empty draft clears the field, so emptying the control
		* and saving is the same gesture as resetting it.
		* @param field - field name inside the namespace section.
		* @returns the field's conversion spec.
		*/
		function textField(field) {
			return {
				field,
				format: (value) => typeof value === "string" ? value : "",
				parse: (text) => {
					const trimmed = text.trim();
					return trimmed === "" ? { kind: "clear" } : {
						kind: "set",
						value: trimmed
					};
				}
			};
		}
		/**
		* Stages one card's edits over one settings namespace and writes them on save.
		*
		* The form publishes through a snapshot store because slot components read
		* through a snapshot selector, while both the scope and the local drafts
		* change underneath; every projection is rebuilt from the two together.
		*/
		var CardForm = class {
			scope;
			specs;
			secretSpecs;
			staged = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			saving = false;
			failed = false;
			/**
			* @param scope - the bound settings scope for this card's namespace.
			* @param specs - the section fields this card edits.
			* @param secrets - the card's write-only controls, written outside the section.
			*/
			constructor(scope, specs, secrets = []) {
				this.scope = scope;
				this.specs = new Map(specs.map((spec) => [spec.field, spec]));
				this.secretSpecs = new Map(secrets.map((spec) => [spec.field, spec]));
				scope.subscribe(() => {
					this.publish();
				});
			}
			/**
			* Publish a projection of this form, rebuilt whenever the scope or a draft changes.
			* @param project - build the card's state from the form's current reads.
			* @returns the store the card's component reads through its bound selector.
			*/
			bind(project) {
				const store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(project());
				this.listeners.add(() => {
					store.set(project());
				});
				return store;
			}
			/**
			* Read the card-level state: what the Host serves, and what a save would do.
			* @returns the form state every card shares.
			*/
			shell() {
				const snapshot = this.scope.getSnapshot();
				const plan = this.plan();
				return {
					available: snapshot.status === "ready",
					writable: snapshot.writable,
					dirty: plan.length > 0,
					invalid: plan.some((item) => item.run === void 0),
					saving: this.saving,
					failed: this.failed
				};
			}
			/**
			* Read one control's state.
			* @param field - field name of a section field or of a write-only control.
			* @returns the draft text, whether a save would leave an override, and whether it is invalid.
			*/
			field(field) {
				const staged = this.staged.get(field);
				if (this.secretSpecs.has(field)) return {
					text: staged?.text ?? "",
					overridden: false,
					invalid: false
				};
				const spec = this.spec(field);
				if (staged === void 0) return {
					text: spec.format(this.sectionValue(field)),
					overridden: this.stored(field),
					invalid: false
				};
				const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
				return {
					text: staged.text,
					overridden: write?.kind === "set",
					invalid: write === void 0
				};
			}
			/**
			* Build the edit, reset, save, and discard actions bound to this form.
			* @returns the actions a card's slot entry injects.
			*/
			actions() {
				return {
					edit: (field, text) => {
						this.stage(field, {
							text,
							clear: false
						});
					},
					resetField: (field) => {
						this.stage(field, {
							text: this.spec(field).format(this.baseValue(field)),
							clear: true
						});
					},
					save: () => {
						this.save();
					},
					discard: () => {
						if (this.staged.size === 0 && !this.failed) return;
						this.staged.clear();
						this.failed = false;
						this.publish();
					}
				};
			}
			/**
			* Write every staged edit, then re-seed from what the Host accepted.
			*
			* The Host is the only authority on whether a value was accepted — its
			* validators own the constraints no schema can express — so the outcome is
			* read back from the section rather than predicted here. A save that did not
			* land keeps its drafts, so the user can correct them instead of retyping.
			* @returns settlement after every write and the read-back.
			*/
			async save() {
				const plan = this.plan();
				const writes = plan.flatMap((item) => item.run === void 0 ? [] : [item.run]);
				if (plan.length === 0 || this.saving || writes.length !== plan.length) return;
				this.saving = true;
				this.failed = false;
				this.publish();
				let landed = true;
				for (const write of writes) landed = await write() && landed;
				if (landed) this.staged.clear();
				this.saving = false;
				this.failed = !landed;
				this.publish();
			}
			/**
			* Every staged edit a save would write. An entry whose draft is not a value
			* its field accepts carries no write: the form is still dirty, and the save
			* refuses rather than dropping the edit.
			* @returns the planned writes, in the order the fields were staged.
			*/
			plan() {
				const plan = [];
				for (const [field, staged] of this.staged) {
					const secret = this.secretSpecs.get(field);
					if (secret !== void 0) {
						const value = staged.text.trim();
						if (value !== "") plan.push({
							field,
							run: () => secret.write(value)
						});
						continue;
					}
					const spec = this.spec(field);
					if (staged.clear) {
						if (this.stored(field)) plan.push({
							field,
							run: () => this.clear(field)
						});
						continue;
					}
					if (staged.text === spec.format(this.sectionValue(field))) continue;
					const write = spec.parse(staged.text);
					if (write === void 0) plan.push({
						field,
						run: void 0
					});
					else if (write.kind === "clear") plan.push({
						field,
						run: () => this.clear(field)
					});
					else plan.push({
						field,
						run: () => this.store(field, write.value)
					});
				}
				return plan;
			}
			async clear(field) {
				await this.scope.unset(field);
				return !this.stored(field);
			}
			async store(field, value) {
				await this.scope.set(field, value);
				return sameFieldValue(this.userLayer()?.[field], value);
			}
			stage(field, edit) {
				this.staged.set(field, edit);
				this.failed = false;
				this.publish();
			}
			spec(field) {
				const spec = this.specs.get(field);
				if (spec === void 0) throw new Error(`plugin card has no field ${field}`);
				return spec;
			}
			snapshotOf() {
				return this.scope.getSnapshot();
			}
			sectionValue(field) {
				return this.snapshotOf().value?.[field];
			}
			baseValue(field) {
				return this.snapshotOf().base?.[field];
			}
			userLayer() {
				return this.snapshotOf().user;
			}
			stored(field) {
				const user = this.userLayer();
				return user !== void 0 && Object.hasOwn(user, field);
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};
		/** Compare the scalar and string-list values supported by plugin cards. */
		function sameFieldValue(actual, expected) {
			if (!Array.isArray(actual) || !Array.isArray(expected)) return actual === expected;
			return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
		}
		//#endregion
		//#region src/client/geo-server-card-controller.ts
		/**
		* Namespace of the geoserver consumer. Spelled here rather than imported: a
		* client package must not depend on a Host package. The card registration keys
		* itself to this string.
		*/
		const GEOSERVER_NS = "geoserver";
		/** Credential reference the host plugin resolves for Basic-auth. */
		const GEOSERVER_PASSWORD_REF = "GEOSERVER_PASS";
		/** Form field the credential control stages under. */
		const PASSWORD_FIELD = "password";
		/**
		* A `SettingsScope` backed by the plugin's own `/geoserver/config` route.
		*
		* Implements the same contract the settings RPC scope does — sync snapshot,
		* subscribe, `set`, `unset` — so `CardForm` is reused unchanged. Writes land
		* through a same-origin POST the host plugin serves; the host writes them into
		* the `geoserver` settings namespace directly, so the values still live in the
		* settings document (profile backup and uninstall cleanup recognize them).
		*/
		var RouteSettingsScope = class {
			snapshot = {
				status: "ready",
				value: {},
				base: void 0,
				user: {},
				revision: void 0,
				writable: true,
				mode: "host"
			};
			listeners = /* @__PURE__ */ new Set();
			constructor() {
				this.reload();
			}
			/** @returns the current sync snapshot (stable reference until the next change). */
			getSnapshot() {
				return this.snapshot;
			}
			/**
			* Observe snapshot replacements.
			* @param listener - invoked after each snapshot change.
			* @returns the disposer removing this listener.
			*/
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			/**
			* Queue one field write through the route.
			* @param field - field inside the section.
			* @param value - JSON-shaped value selected by the user.
			*/
			async set(field, value) {
				await this.post({ [field]: value });
			}
			/**
			* Queue one field clear through the route, so the field re-inherits the
			* composition layer.
			* @param field - field inside the section.
			*/
			async unset(field) {
				await this.post({ unset: [field] });
			}
			/** POST one write and re-read the section the host now serves. */
			async post(body) {
				const response = await fetch("/geoserver/config", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body)
				});
				if (!response.ok) throw new Error(`geoserver config write failed (${response.status})`);
				await this.reload();
			}
			/** Re-read the section from the route and publish the new snapshot. */
			async reload() {
				try {
					const response = await fetch("/geoserver/config");
					if (!response.ok) throw new Error(`geoserver config read failed (${response.status})`);
					const responseBody = await response.json();
					this.snapshot = {
						status: "ready",
						value: responseBody.value,
						base: responseBody.base,
						user: responseBody.user,
						revision: void 0,
						writable: true,
						mode: "host"
					};
				} catch {
					this.snapshot = {
						status: "unavailable",
						value: void 0,
						base: void 0,
						user: void 0,
						revision: void 0,
						writable: false,
						mode: "host"
					};
				}
				for (const listener of this.listeners) listener();
			}
		};
		/** Bridges the config route and the credentials domain onto the card. */
		var GeoserverCardController = class {
			api;
			form;
			store;
			credential = {
				ref: GEOSERVER_PASSWORD_REF,
				configured: false,
				writable: true
			};
			/**
			* @param api - wire face used for the password the section references.
			*/
			constructor(api) {
				this.api = api;
				this.form = new CardForm(new RouteSettingsScope(), [
					textField("baseUrl"),
					textField("username"),
					lineListField("publishRoots"),
					textField("defaultWorkspace"),
					positiveIntegerField("publishMaxBytes"),
					textField("webhookUrl"),
					textField("webhookTokenEnv"),
					positiveIntegerField("webhookTimeoutMs")
				], [{
					field: PASSWORD_FIELD,
					write: (text) => this.writePassword(text)
				}]);
				this.store = this.form.bind(() => this.projection());
				this.readCredential();
			}
			projection() {
				return {
					...this.form.shell(),
					baseUrl: this.form.field("baseUrl"),
					username: this.form.field("username"),
					publishRoots: this.form.field("publishRoots"),
					defaultWorkspace: this.form.field("defaultWorkspace"),
					publishMaxBytes: this.form.field("publishMaxBytes"),
					webhookUrl: this.form.field("webhookUrl"),
					webhookTokenEnv: this.form.field("webhookTokenEnv"),
					webhookTimeoutMs: this.form.field("webhookTimeoutMs"),
					password: this.form.field(PASSWORD_FIELD),
					passwordConfigured: this.credential.configured,
					passwordWritable: this.credential.writable
				};
			}
			/**
			* Ask the credentials domain about the password reference.
			*
			* The answer is stored with the reference it describes; the reference is
			* fixed for this card, so an out-of-order response cannot mislead.
			*/
			async readCredential() {
				let response;
				try {
					response = await this.api.credentials.describe({ refs: [GEOSERVER_PASSWORD_REF] });
				} catch (_credentialReadFailure) {
					return;
				}
				if (!response.result.ok) return;
				const view = response.result.value.credentials[GEOSERVER_PASSWORD_REF];
				const next = {
					ref: GEOSERVER_PASSWORD_REF,
					configured: view?.configured ?? false,
					writable: view?.writable ?? true
				};
				if (next.configured === this.credential.configured && next.writable === this.credential.writable) return;
				this.credential = next;
				this.store.set(this.projection());
			}
			/**
			* Build the face the card's slot registration injects.
			* @returns the card's snapshot and its form actions.
			*/
			inject() {
				return {
					hooks: { geoserverCard: this.store },
					...this.form.actions()
				};
			}
			/**
			* Write the staged password, then re-read whether the Host now holds one.
			* @param value - the staged credential literal.
			* @returns whether the Host reports a configured credential afterwards.
			*/
			async writePassword(value) {
				try {
					await this.api.credentials.set({
						ref: GEOSERVER_PASSWORD_REF,
						value
					});
				} catch (_credentialWriteFailure) {}
				await this.readCredential();
				return this.credential.configured;
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/** English copy. */
		const en = {
			overridden: "Overridden",
			reset: "Reset to default",
			readOnly: "This deployment stores settings read-only.",
			expand: "Show settings",
			collapse: "Hide settings",
			save: "Save",
			saving: "Saving…",
			discard: "Discard",
			unsaved: "Unsaved",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			invalidNumber: "Enter a number, or leave blank to use the default.",
			invalidPositiveInteger: "Enter a positive whole number, or leave blank to use the default.",
			geoserverTitle: "GeoServer",
			geoserverDescription: "Connection, publication, and business notification settings for the geoserver tools.",
			geoserverBaseUrl: "Server URL",
			geoserverBaseUrlHint: "GeoServer base URL, e.g. http://host:8080/geoserver.",
			geoserverUsername: "Username",
			geoserverUsernameHint: "Basic-auth user; leave blank for anonymous access.",
			geoserverPassword: "Password",
			geoserverPasswordHint: "Stored outside the settings file. Leave blank to keep the current password.",
			geoserverPasswordSet: "A password is configured.",
			geoserverPasswordUnset: "No password is configured; anonymous access only.",
			geoserverPublishRoots: "Publication source directories",
			geoserverPublishRootsHint: "One local directory per line. Publication is disabled while this list is empty.",
			geoserverDefaultWorkspace: "Default publication workspace",
			geoserverDefaultWorkspaceHint: "Used when a publication request does not name a workspace. A request can override it.",
			geoserverPublishMaxBytes: "Maximum source file size (bytes)",
			geoserverPublishMaxBytesHint: "Largest GeoTIFF or SHP ZIP accepted; default 536870912 (512 MiB).",
			geoserverWebhookUrl: "Business webhook URL",
			geoserverWebhookUrlHint: "Optional endpoint that receives confirmed publication results and caller metadata.",
			geoserverWebhookTokenEnv: "Webhook token environment variable",
			geoserverWebhookTokenEnvHint: "Name only, for example BUSINESS_WEBHOOK_TOKEN. The token itself stays on the server.",
			geoserverWebhookTimeoutMs: "Webhook timeout (milliseconds)",
			geoserverWebhookTimeoutMsHint: "Maximum wait for the business webhook; default 5000."
		};
		/** Simplified Chinese copy. */
		const zh = {
			overridden: "已覆盖",
			reset: "恢复默认",
			readOnly: "本部署的设置为只读。",
			expand: "展开设置",
			collapse: "收起设置",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			unsaved: "未保存",
			saveFailed: "部署未接受这些值，已保留供你修改。",
			invalidNumber: "请输入数字，或留空使用默认值。",
			invalidPositiveInteger: "请输入正整数，或留空使用默认值。",
			geoserverTitle: "GeoServer",
			geoserverDescription: "geoserver 工具的连接、发布和业务通知设置。",
			geoserverBaseUrl: "服务器地址",
			geoserverBaseUrlHint: "GeoServer 基础地址，例如 http://host:8080/geoserver。",
			geoserverUsername: "用户名",
			geoserverUsernameHint: "Basic 认证用户名；留空表示匿名访问。",
			geoserverPassword: "密码",
			geoserverPasswordHint: "存储在设置文件之外。留空则保留当前密码。",
			geoserverPasswordSet: "已配置密码。",
			geoserverPasswordUnset: "未配置密码，仅匿名访问。",
			geoserverPublishRoots: "发布源目录",
			geoserverPublishRootsHint: "每行填写一个本地目录；列表为空时禁用发布能力。",
			geoserverDefaultWorkspace: "默认发布工作区",
			geoserverDefaultWorkspaceHint: "发布命令未指定工作区时使用；命令中指定的工作区会覆盖此值。",
			geoserverPublishMaxBytes: "源文件最大字节数",
			geoserverPublishMaxBytesHint: "允许上传的最大 GeoTIFF 或 SHP ZIP；默认 536870912（512 MiB）。",
			geoserverWebhookUrl: "业务回调地址",
			geoserverWebhookUrlHint: "可选；图层确认发布成功后，将结果和调用方元数据发送到这里。",
			geoserverWebhookTokenEnv: "回调令牌环境变量名",
			geoserverWebhookTokenEnvHint: "只填变量名，例如 BUSINESS_WEBHOOK_TOKEN；真正的令牌仅保存在服务器。",
			geoserverWebhookTimeoutMs: "回调超时（毫秒）",
			geoserverWebhookTimeoutMsHint: "等待业务回调的最长时间；默认 5000。"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "geoserver";
		/** Required services (cordis fiber inject). `settingsScope` is deliberately
		* NOT here: naming it at module level would keep this whole plugin unmounted
		* on any host without that service. It is probed with a nested inject instead
		* (same pattern as dsh-market), so the card simply never appears on hosts
		* without the plugin configuration page. */
		const inject = [
			"slots",
			"locale",
			"connection"
		];
		/**
		* Mount the GeoServer card into the plugin configuration section.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const { api } = ctx.get("connection");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-geoserver: section dictionaries");
			const card = new GeoserverCardController(api);
			ctx.inject(["settingsScope"], (scoped) => {
				scoped.slots.inject("settings.plugin.item", () => scoped.slots.register({
					name: "settings.plugin.item",
					id: GEOSERVER_NS,
					order: 30,
					locale: NS,
					inject: () => card.inject()
				}, GeoserverCard));
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map