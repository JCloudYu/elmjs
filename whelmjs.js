/**
 *	Author: JCloudYu
 *	Create: 2020/01/19
**/
(()=>{
	"use strict";
	
	const _VERSION		= "1.2.1";
	const _EVENT_FORMAT = /^((bubble::)?[a-zA-Z0-9\-_ ]+::[a-zA-Z0-9\-_ ]+)(,([a-zA-Z0-9\-_ ]+::[a-zA-Z0-9\-_ ]+))*$/;
	const _MAP_TEXT_FORMAT = /^([a-zA-Z0-9\-_#.]+(::[a-zA-Z0-9\-_]+)?)(,([a-zA-Z0-9\-_#.]+(::[a-zA-Z0-9\-_]+)?))*$/;
	const _PRIVATES		= new WeakMap();
	const _EVENT_MAP	= new WeakMap();
	const _INST_MAP		= new WeakMap();
	const _CONTROLLERS	= new Map();
	
	
	const ElmAccessorProxyHandler = {
		getPrototypeOf: function(obj) {
			return Object.getPrototypeOf(obj);
		},
		get: function(obj, prop) {
			const {element, exported, func_bind, func_relink, func_bind_event, func_unbind_event, func_emit_event} = _PRIVATES.get(obj);
			if ( prop === 'element' ) return element;
			if ( prop === 'is_accessor' ) return true;
			if ( prop === 'bind' ) return func_bind;
			if ( prop === 'relink' ) return func_relink;
			if ( prop === 'on' || prop === 'addEventListener' ) return func_bind_event;
			if ( prop === 'off' || prop === 'removeEventListener' ) return func_unbind_event;
			if ( prop === 'emit' || prop === 'dispatchEvent' ) return func_emit_event;
			
			return exported[prop] || obj[prop];
		},
		set: function(obj, prop, value) {
			if ( prop === "element" ) return false;
			if ( prop === "bind" ) return false;
			if ( prop === "relink" ) return false;
			
			const {exported} = _PRIVATES.get(obj);
			if ( !exported[prop] ) {
				obj[prop] = value;
			}
			return true;
		}
	};
	const ELM_JS_ENDPOINT = (html_element)=>{
		if ( !(html_element instanceof Element) ) {
			throw new TypeError( "Given item must be an Element instance!" );
		}
		
		
		let controller;
		const [inst, cast_inst] = ___PARSE_EXPORTED_INST(html_element);
		if ( inst === "" || inst === "accessor" ) {
			controller = ___ACCESSOR_COMPONENT(html_element);
		}
		else
		if ( inst === "template" ) {
			controller = new ElmTemplate(html_element, cast_inst);
		}
		else {
			controller = ___INSTANTIATE_CONTROLLER(inst, html_element);
		}
		
		
		
		_INST_MAP.set(html_element, controller);
		return controller;
	};
	ELM_JS_ENDPOINT.Version = _VERSION;
	ELM_JS_ENDPOINT.DOM = (selector, strip_tags='script')=>{
		const IS_HTML_SYNTAX = (selector[0]==="<" && selector[selector.length-1]===">");
		if ( !IS_HTML_SYNTAX ) {
			if ( selector.substring(0, 3) === "~* " ) {
				return document.querySelectorAll(selector.substring(3));
			}
			else {
				return document.querySelector(selector);
			}
		}
		
		if ( selector === "<script>" ) {
			return document.createElement('script');
		}
		
		
		
		const fake_doc = document.implementation.createHTMLDocument(document.title||'');
		fake_doc.body.innerHTML = selector;
		
		const stripped_tags = strip_tags.split(',');
		for(const tag of stripped_tags) {
			const elements = fake_doc.body.querySelectorAll(tag);
			for(const element of elements) element.remove();
		}
		
		const children = Array.prototype.slice.call(fake_doc.body.children, 0);
		return children.length < 2 ? (children[0]||null) : children;
	};
	ELM_JS_ENDPOINT.BindInst = (name, controller, is_constructor=true)=>{
		if ( typeof controller !== "function" ) {
			throw new TypeError( "Argument 2 must be a constructor!" );
		}
		
		name = (''+(name||'')).trim();
		
		const info = Object.create(null);
		info.controller = controller;
		info.construct = !!is_constructor;
		
		_CONTROLLERS.set(name, info);
	};
	ELM_JS_ENDPOINT.GetInst = ELM_JS_ENDPOINT.GetInstance = (element)=>{
		return _INST_MAP.get(element)||null;
	};
	
	
	const _TEXT_MAPPER = Object.create(null);
	_TEXT_MAPPER['_default'] = [];
	
	let _TEXT_GROUP = '';
	ELM_JS_ENDPOINT.UseTextMapGroup = (group)=>{
		_TEXT_GROUP = (''+(group||'')).trim();
	};
	ELM_JS_ENDPOINT.BindTextMap = function(map, group='_default') {
		if ( typeof group !== "string" ) {
			throw new TypeError("Input map group should be a string identifier!");
		}
	
		const is_map_func = typeof map === "function";
		const is_map_obj  = Object(map) === map;
		if ( !is_map_func && !is_map_obj ) {
			throw new TypeError("Input map should be an object or a function!");
		}
		
		const map_group = _TEXT_MAPPER[group] = _TEXT_MAPPER[group]||[];
		const idx = map_group.indexOf(map);
		if ( idx < 0 ) {
			map_group.push(map);
		}
		
		return ELM_JS_ENDPOINT;
	};
	ELM_JS_ENDPOINT.UnbindTextMap = function(map, group='_default') {
		if ( typeof group !== "string" ) {
			throw new TypeError("Input map group should be a string identifier!");
		}
	
		const is_map_func = typeof map === "function";
		const is_map_obj  = Object(map) === map;
		if ( !is_map_func && !is_map_obj ) {
			throw new TypeError("Input map should be an object or a function!");
		}
		
		const map_group = _TEXT_MAPPER[group] = _TEXT_MAPPER[group]||[];
		const idx = map_group.indexOf(map);
		if ( idx >= 0 ) map_group.splice(idx, 1);
		
		return ELM_JS_ENDPOINT;
	};
	function ___MAP_TEXT(key) {
		const group = _TEXT_MAPPER[_TEXT_GROUP]||_TEXT_MAPPER['_default'];
		for(let i=group.length; i>0; i--) {
			const map = group[i-1];
			const map_result = (typeof map === "function") ? map(key) : map[key];
			if ( map_result !== undefined ) {
				return (''+(map_result||''));
			}
		}
		
		return key;
	}
	
	
	
	
	ELM_JS_ENDPOINT.controller = function(name, controller, is_constructor=true) {
		console.warn("WhelmJS.controller is marked as deprecated! Please use WhelmJS.BindInst instead!");
		return ELM_JS_ENDPOINT.BindInst(...Array.prototype.slice.call(arguments, 0));
	};
	ELM_JS_ENDPOINT.DefineBlueprint = function(name, controller, is_constructor=true) {
		console.warn("WhelmJS.DefineBlueprint is marked as deprecated! Please use WhelmJS.BindInst instead!");
		return ELM_JS_ENDPOINT.BindInst(...Array.prototype.slice.call(arguments, 0));
	};
	window.WhelmJS = Object.freeze(ELM_JS_ENDPOINT);
	
	
	
	
	function ___ACCESSOR_COMPONENT(html_element) {
		const inst  = new ElmAccessor(html_element);
		const proxy = new Proxy(inst, ElmAccessorProxyHandler);
		Object.assign(_PRIVATES.get(inst), {
			proxy,
			func_bind:ElmAccessor.prototype.bind.bind(inst),
			func_relink:ElmAccessor.prototype.relink.bind(inst),
			func_bind_event:___ADD_EVENT_LISTENER.bind(inst, proxy),
			func_unbind_event:___REMOVE_EVENT_LISTENER.bind(inst, proxy),
			func_emit_event:___DISPATCH_EVENT.bind(inst, proxy)
		});
		
		_INST_MAP.set(html_element, proxy);
		return proxy;
	}
	class ElmAccessor {
		constructor(element=null) {
			const _PRIVATE = Object.assign(Object.create(null), {
				element:null, exported:Object.create(null)
			});
			_PRIVATES.set(this, _PRIVATE);
			
			
			if ( arguments.length === 0 ) return;
			
			this.bind(element);
		}
		bind(element) {
			if ( !(element instanceof Element) ) {
				throw new TypeError( "ElmAccessor constructor only accept Element instances!" );
			}
			
			const _PRIVATE = _PRIVATES.get(this);
			_PRIVATE.element = element;
			_PRIVATE.exported = Object.create(null);
			
			this.relink();
		}
		relink() {
			const _PRIVATE = _PRIVATES.get(this);
			_PRIVATE.exported = Object.create(null);
			
			const {element, exported} = _PRIVATE;
			__PARSE_ELEMENT(exported, element, element);
		}
	}
	class ElmTemplate {
		constructor(element, dst_inst='') {
			if ( typeof element === "string" ) {
				var tmp = document.implementation.createHTMLDocument();
				tmp.body.innerHTML = element;
				if ( tmp.body.children.length !== 1 ) {
					throw new TypeError( "HTMLTemplate constructor only html string that is resolved as single Element instance!" );
				}
				
				element = tmp.body.children[0];
			}
			else
			if ( element instanceof Element ) {
				element.remove();
				element = element.cloneNode(true);
			}
			else {
				throw new TypeError( "HTMLTemplate constructor only accepts an Element instance!" );
			}
			
			
			
			Object.defineProperties(this, {
				_tmpl_elm: {
					configurable:false, writable:false, enumerable:false,
					value:element
				},
				_tmpl_dst_inst: {
					configurable:false, writable:false, enumerable:false,
					value: dst_inst || 'accessor'
				}
			});
			
			element.removeAttribute('elm-export-tmpl');
			element.removeAttribute('elm-export-inst');
			element.removeAttribute('elm-export');
		}
		get is_template() { return true; }
		duplicate() {
			const {_tmpl_elm:elm, _tmpl_dst_inst:inst} = this;
			const item = elm.cloneNode(true);
			const controller = (inst==="accessor")?___ACCESSOR_COMPONENT(item):___INSTANTIATE_CONTROLLER(inst, item);
			
			_INST_MAP.set(item, controller);
			return controller;
		}
	}
	function __PARSE_ELEMENT(exports, root_element, element) {
		const candidates = [];
		for (const item of Array.prototype.slice.call(element.children, 0)) {
			const exported = __PARSE_ELM_EXPORTS(exports, root_element, item);
			if ( exported === null ) {
				if ( item instanceof HTMLTemplateElement ) {
					candidates.push(item.content);
				}
				else {
					candidates.push(item);
				}
			}
			
			__PARSE_ELM_ATTRIBUTES(root_element, item, exported);
		}
		
		for(const elm of candidates) {
			__PARSE_ELEMENT(exports, root_element, elm);
		}
	}
	function __PARSE_ELM_EXPORTS(exports, root_element, item) {
		const has_export = item.hasAttribute('elm-export');
		const has_export_inst = item.hasAttribute('elm-export-inst');
		const has_export_accessor = item.hasAttribute('elm-export-accessor');
		const has_export_tmpl = item.hasAttribute('elm-export-tmpl');
		const is_exported = has_export || has_export_inst || has_export_accessor || has_export_tmpl;
		
		
		if ( !is_exported ) { return null; }
		
		
		const export_name = has_export ? (item.getAttribute('elm-export')??'').trim() : false;
		if ( export_name === "" ) {
			console.error(item);
			throw new SyntaxError("[elm-export] attribute's content value should not be empty!");
		}
		
		
		
		if ( has_export && item.hasAttribute('elm-detached') ) {
			item.remove();
		}
		
		
		const [inst, cast_inst] = ___PARSE_EXPORTED_INST(item);
		if ( inst === "" ) {
			if ( export_name !== false ) {
				exports[export_name] = item;
			}
			
			return null;
		}
		
		
		
		let controller;
		if ( inst === "accessor" ) {
			controller = ___ACCESSOR_COMPONENT(item);
		}
		else
		if ( inst === "template" ) {
			controller = new ElmTemplate(item, cast_inst);
		}
		else {
			controller = ___INSTANTIATE_CONTROLLER(inst, item);
		}
		
		
		
		_INST_MAP.set(item, controller);
		
		if ( export_name !== false ) {
			exports[export_name]=controller
		}
		
		
		
		return controller;
	}
	function __PARSE_ELM_ATTRIBUTES(root_element, item, related_instance) {
		// Normal element with event
		const bind_event  = item.hasAttribute('elm-bind-event');
		const bind_bubble_event = item.hasAttribute('elm-bind-event-bubble');
		if ( bind_event || bind_bubble_event ) {
			let ITEM_EVENT_MAP = _EVENT_MAP.get(item);
			if ( !ITEM_EVENT_MAP ) {
				ITEM_EVENT_MAP = new Map();
				_EVENT_MAP.set(item, ITEM_EVENT_MAP);
			}
			
			
			const event_descriptor = item.getAttribute(bind_bubble_event ? 'elm-bind-event-bubble' : 'elm-bind-event').trim();
			const matches = _EVENT_FORMAT.test(event_descriptor);
			if ( !matches ) {
				console.error(item);
				throw new SyntaxError(`Incorrect event '${event_descriptor}' in ${item.tagName}[elm-bind-event] attribute!`);
			}
			
			
			
			const event_tuples = event_descriptor.split(',');
			for(const event_tuple of event_tuples) {
				const event_spec = event_tuple.split('::');
				let bubble_specifier=null, _source_event, _dest_event;
				event_spec.length === 2 ? ([_source_event, _dest_event]=event_spec) : ([bubble_specifier, _source_event, _dest_event]=event_spec);
				
				const should_bubble	= bind_bubble_event||(!!bubble_specifier);
				let source_event 	= _source_event.trim();
				let dest_event 		= _dest_event.trim();

				if ( dest_event === '' ) {
					dest_event = source_event;
				}
				
				const event_identifier = `${source_event}::${dest_event}`;
				const prev_handler = ITEM_EVENT_MAP.get(event_identifier);
				if ( prev_handler ) {
					item.removeEventListener(source_event, prev_handler);
					ITEM_EVENT_MAP.delete(event_identifier);
				}
				
				
				
				
				const event_dispatcher = (e)=>{
					const event = new Event(dest_event, {bubbles:should_bubble});
					Object.defineProperties(event, {
						original: {value:e, configurable:false, enumerable:true, writable:false},
						instance: {value:related_instance||item, configurable:false, enumerable:true, writable:false},
						original_event: {get:()=>{
							console.error("original_event property is deprecated and will be removed soon! Please use original instead!");
							return event.original;
						}, configurable:false, enumerable:true},
					});
					root_element.dispatchEvent(event);
				};
				
				item.addEventListener(source_event, event_dispatcher);
				ITEM_EVENT_MAP.set(event_identifier, event_dispatcher)
			}
		}
		
		
		
		const should_map_text = item.hasAttribute('elm-map-text');
		if ( should_map_text ) {
			const map_text = item.getAttribute('elm-map-text');
			if ( !_MAP_TEXT_FORMAT.test(map_text) ) {
				console.error(item);
				throw new SyntaxError(`Given ${item.tagName}[elm-map-text] attribute contains invalid attribute!`);
			}
			
			const map_list = map_text.trim().split(',').map((item)=>item.trim()).filter((item)=>item!=="");
			for (const map of map_list) {
				const [text, target_attr] = map.split('::').map((item)=>item.trim());
				const mapped_text = ___MAP_TEXT(text);
				if (target_attr) {
					item.setAttribute(target_attr, mapped_text);
				}
				else {
					item.textContent = mapped_text;
				}
			}
		}
	}
	
	
	
	function ___PARSE_EXPORTED_INST(html_element) {
		if ( html_element.hasAttribute('elm-export-inst') ) {
			const [inst, dst_inst] = html_element.getAttribute('elm-export-inst').trim().split('::');
			if ( dst_inst !== undefined && inst !== "template" ) {
				console.error(html_element);
				throw new SyntaxError("Instance resolution operator :: is only allowed in template mode!");
			}
			
			if ( !inst || inst === "accessor" ) {
				return ["accessor"];
			}
			else
			if ( inst === "template" ) {
				return ["template", dst_inst||null];
			}
			else {
				return [inst];
			}
		}
		else
		if ( html_element.hasAttribute('elm-export-tmpl') ) {
			return ["template"];
		}
		else
		if ( html_element.hasAttribute('elm-export-accessor') ) {
			return ["accessor"];
		}
		
		return [""];
	}
	function ___INSTANTIATE_CONTROLLER(inst, item) {
		const info = _CONTROLLERS.get(inst);
		if ( !info ) {
			console.error(item);
			throw new TypeError(`Destination controller '${inst}' is not registered yet!`);
		}
		
		const {controller:_controller, construct} = info;
		return construct ? new _controller(item) : _controller(item);
	}
	function ___ADD_EVENT_LISTENER(proxy, events, listener, ...args) {
		const {element} = _PRIVATES.get(this);
		if ( !element ) return proxy;
		
		const event_names = events.split(',');
		for(const event of event_names) {
			element.addEventListener(event, listener, ...args);
		}
		return proxy;
	}
	function ___REMOVE_EVENT_LISTENER(proxy, events, listener, ...args) {
		const {element} = _PRIVATES.get(this);
		if ( !element ) return proxy;
		
		const event_names = events.split(',');
		for(const event of event_names) {
			element.removeEventListener(event, listener, ...args);
		}
		return proxy;
	}
	function ___DISPATCH_EVENT(proxy, event) {
		const {element} = _PRIVATES.get(this);
		if ( !element ) return proxy;
		
		if ( typeof event === "string" ) {
			event = new Event(event);
		}
		
		if ( !(event instanceof Event) ) {
			throw new TypeError("Argument 1 must be a string or an Event instance!");
		}
		
		element.dispatchEvent(event);
		return proxy;
	}
})();
