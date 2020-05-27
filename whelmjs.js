/**
 *	Author: JCloudYu
 *	Create: 2020/01/19
**/
(()=>{
	"use strict";
	
	const _VERSION		= "1.0.11";
	const _HTML_SYNTAX	= /^<.*>$/;
	const _EVENT_FORMAT = /^((bubble::)?[a-zA-Z0-9\-_ ]+::[a-zA-Z0-9\-_ ]+)(,([a-zA-Z0-9\-_ ]+::[a-zA-Z0-9\-_ ]+))?$/;
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
		const inst = new ElmAccessor(html_element);
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
	};
	ELM_JS_ENDPOINT.Version = _VERSION;
	ELM_JS_ENDPOINT.DOM = (selector, strip_tags='script,style')=>{
		if ( !_HTML_SYNTAX.test(selector) ) {
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
	ELM_JS_ENDPOINT.DefineBlueprint = ELM_JS_ENDPOINT.controller = (name, controller, is_constructor=true)=>{
		if ( typeof controller !== "function" ) {
			throw new TypeError( "Argument 2 must be a constructor!" );
		}
		
		name = (''+(name||'')).trim();
		
		const info = Object.create(null);
		info.controller = controller;
		info.construct = !!is_constructor;
		
		_CONTROLLERS.set(name, info);
	};
	ELM_JS_ENDPOINT.GetInstance = (element)=>{
		return _INST_MAP.get(element)||null;
	};
	window.WhelmJS = Object.freeze(ELM_JS_ENDPOINT);
	
	
	
	
	
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
		constructor(element) {
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
				}
			});
			
			element.removeAttribute('elm-export-tmpl');
			element.removeAttribute('elm-export');
		}
		get is_template() { return true; }
		duplicate() {
			return ELM_JS_ENDPOINT(this._tmpl_elm.cloneNode(true));
		}
	}
	function __PARSE_ELEMENT(exports, root_element, element) {
		const candidates = [];
		for (const item of Array.prototype.slice.call(element.children, 0)) {
			__PARSE_ELM_ATTRIBUTES(root_element, item);
			
			const controller_exported = __PARSE_ELM_EXPORTS(exports, root_element, item);
			if ( !controller_exported ) {
				if ( item instanceof HTMLTemplateElement ) {
					candidates.push(item.content);
				}
				else {
					candidates.push(item);
				}
			}
		}
		
		for(const elm of candidates) {
			__PARSE_ELEMENT(exports, root_element, elm);
		}
	}
	function __PARSE_ELM_EXPORTS(exports, root_element, item) {
		if ( !item.hasAttribute('elm-export') ) {
			return false;
		}
		
		if ( item.hasAttribute('elm-detached') ) {
			item.remove();
		}
		
		
		
		const export_name = item.getAttribute('elm-export');
		let controller = null;
		if ( item.hasAttribute('elm-export-inst') ) {
			const inst = item.getAttribute('elm-export-inst').trim();
			if ( !inst || inst === "accessor" ) {
				controller = ELM_JS_ENDPOINT(item);
			}
			else
			if ( inst === "template" ) {
				controller = new ElmTemplate(item);
			}
			else {
				const info = _CONTROLLERS.get(inst);
				if ( !info ) {
					throw new TypeError(`Destination controller '${inst}' is not registered yet!`);
				}
				
				const {controller:_controller, construct} = info;
				controller = construct ? new _controller(item) : _controller(item);
			}
		}
		else
		if ( item.hasAttribute('elm-export-tmpl') ) {
			controller = new ElmTemplate(item);
		}
		else
		if ( item.hasAttribute('elm-export-accessor') ) {
			controller = ELM_JS_ENDPOINT(item);
		}
		
		
		
		exports[export_name] = controller||item;
		if ( !controller ) {
			exports[export_name] = item;
			return false;
		}
		
		
		
		_INST_MAP.set(item, exports[export_name] = controller);
		return true;
	}
	function __PARSE_ELM_ATTRIBUTES(root_element, item) {
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
				throw new SyntaxError(`Incorrect event '${event_descriptor}' in 'elm-bind-event' tag`);
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
