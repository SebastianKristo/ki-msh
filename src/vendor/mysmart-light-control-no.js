/* mysmart-light-control – norsk kopi (tekster oversatt, ikke i «Legg til kort»). Original: src/vendor/mysmart-light-control.js */
const e=globalThis,t=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,r=Symbol(),i=new WeakMap;let s=class{constructor(e,t,i){if(this._$cssResult$=!0,i!==r)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const r=this.t;if(t&&void 0===e){const t=void 0!==r&&1===r.length;t&&(e=i.get(r)),void 0===e&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),t&&i.set(r,e))}return e}toString(){return this.cssText}};const o=(e,...t)=>{const i=1===e.length?e[0]:t.reduce((t,r,i)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if("number"==typeof e)return e;throw Error("Value passed to 'css' function must be a 'css' function result: "+e+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(r)+e[i+1],e[0]);return new s(i,e,r)},n=t?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t="";for(const r of e.cssRules)t+=r.cssText;return(e=>new s("string"==typeof e?e:e+"",void 0,r))(t)})(e):e,{is:a,defineProperty:l,getOwnPropertyDescriptor:d,getOwnPropertyNames:h,getOwnPropertySymbols:c,getPrototypeOf:u}=Object,g=globalThis,p=g.trustedTypes,m=p?p.emptyScript:"",_=g.reactiveElementPolyfillSupport,b=(e,t)=>e,f={toAttribute(e,t){switch(t){case Boolean:e=e?m:null;break;case Object:case Array:e=null==e?e:JSON.stringify(e)}return e},fromAttribute(e,t){let r=e;switch(t){case Boolean:r=null!==e;break;case Number:r=null===e?null:Number(e);break;case Object:case Array:try{r=JSON.parse(e)}catch(e){r=null}}return r}},v=(e,t)=>!a(e,t),y={attribute:!0,type:String,converter:f,reflect:!1,useDefault:!1,hasChanged:v};Symbol.metadata??=Symbol("metadata"),g.litPropertyMetadata??=new WeakMap;let $=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=y){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const r=Symbol(),i=this.getPropertyDescriptor(e,r,t);void 0!==i&&l(this.prototype,e,i)}}static getPropertyDescriptor(e,t,r){const{get:i,set:s}=d(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:i,set(t){const o=i?.call(this);s?.call(this,t),this.requestUpdate(e,o,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??y}static _$Ei(){if(this.hasOwnProperty(b("elementProperties")))return;const e=u(this);e.finalize(),void 0!==e.l&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(b("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(b("properties"))){const e=this.properties,t=[...h(e),...c(e)];for(const r of t)this.createProperty(r,e[r])}const e=this[Symbol.metadata];if(null!==e){const t=litPropertyMetadata.get(e);if(void 0!==t)for(const[e,r]of t)this.elementProperties.set(e,r)}this._$Eh=new Map;for(const[e,t]of this.elementProperties){const r=this._$Eu(e,t);void 0!==r&&this._$Eh.set(r,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const r=new Set(e.flat(1/0).reverse());for(const e of r)t.unshift(n(e))}else void 0!==e&&t.push(n(e));return t}static _$Eu(e,t){const r=t.attribute;return!1===r?void 0:"string"==typeof r?r:"string"==typeof e?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),void 0!==this.renderRoot&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const r of t.keys())this.hasOwnProperty(r)&&(e.set(r,this[r]),delete this[r]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const r=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((r,i)=>{if(t)r.adoptedStyleSheets=i.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const t of i){const i=document.createElement("style"),s=e.litNonce;void 0!==s&&i.setAttribute("nonce",s),i.textContent=t.cssText,r.appendChild(i)}})(r,this.constructor.elementStyles),r}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,r){this._$AK(e,r)}_$ET(e,t){const r=this.constructor.elementProperties.get(e),i=this.constructor._$Eu(e,r);if(void 0!==i&&!0===r.reflect){const s=(void 0!==r.converter?.toAttribute?r.converter:f).toAttribute(t,r.type);this._$Em=e,null==s?this.removeAttribute(i):this.setAttribute(i,s),this._$Em=null}}_$AK(e,t){const r=this.constructor,i=r._$Eh.get(e);if(void 0!==i&&this._$Em!==i){const e=r.getPropertyOptions(i),s="function"==typeof e.converter?{fromAttribute:e.converter}:void 0!==e.converter?.fromAttribute?e.converter:f;this._$Em=i;const o=s.fromAttribute(t,e.type);this[i]=o??this._$Ej?.get(i)??o,this._$Em=null}}requestUpdate(e,t,r,i=!1,s){if(void 0!==e){const o=this.constructor;if(!1===i&&(s=this[e]),r??=o.getPropertyOptions(e),!((r.hasChanged??v)(s,t)||r.useDefault&&r.reflect&&s===this._$Ej?.get(e)&&!this.hasAttribute(o._$Eu(e,r))))return;this.C(e,t,r)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:r,reflect:i,wrapped:s},o){r&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,o??t??this[e]),!0!==s||void 0!==o)||(this._$AL.has(e)||(this.hasUpdated||r||(t=void 0),this._$AL.set(e,t)),!0===i&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const e=this.scheduleUpdate();return null!=e&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}const e=this.constructor.elementProperties;if(e.size>0)for(const[t,r]of e){const{wrapped:e}=r,i=this[t];!0!==e||this._$AL.has(t)||void 0===i||this.C(t,void 0,r,i)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};$.elementStyles=[],$.shadowRootOptions={mode:"open"},$[b("elementProperties")]=new Map,$[b("finalized")]=new Map,_?.({ReactiveElement:$}),(g.reactiveElementVersions??=[]).push("2.1.2");const w=globalThis,x=e=>e,C=w.trustedTypes,S=C?C.createPolicy("lit-html",{createHTML:e=>e}):void 0,k="$lit$",A=`lit$${Math.random().toFixed(9).slice(2)}$`,P="?"+A,M=`<${P}>`,E=document,T=()=>E.createComment(""),H=e=>null===e||"object"!=typeof e&&"function"!=typeof e,z=Array.isArray,N="[ \t\n\f\r]",U=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,B=/-->/g,R=/>/g,V=RegExp(`>|${N}(?:([^\\s"'>=/]+)(${N}*=${N}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),L=/'/g,D=/"/g,O=/^(?:script|style|textarea|title)$/i,I=(e=>(t,...r)=>({_$litType$:e,strings:t,values:r}))(1),j=Symbol.for("lit-noChange"),F=Symbol.for("lit-nothing"),W=new WeakMap,G=E.createTreeWalker(E,129);function Y(e,t){if(!z(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(t):t}const X=(e,t)=>{const r=e.length-1,i=[];let s,o=2===t?"<svg>":3===t?"<math>":"",n=U;for(let t=0;t<r;t++){const r=e[t];let a,l,d=-1,h=0;for(;h<r.length&&(n.lastIndex=h,l=n.exec(r),null!==l);)h=n.lastIndex,n===U?"!--"===l[1]?n=B:void 0!==l[1]?n=R:void 0!==l[2]?(O.test(l[2])&&(s=RegExp("</"+l[2],"g")),n=V):void 0!==l[3]&&(n=V):n===V?">"===l[0]?(n=s??U,d=-1):void 0===l[1]?d=-2:(d=n.lastIndex-l[2].length,a=l[1],n=void 0===l[3]?V:'"'===l[3]?D:L):n===D||n===L?n=V:n===B||n===R?n=U:(n=V,s=void 0);const c=n===V&&e[t+1].startsWith("/>")?" ":"";o+=n===U?r+M:d>=0?(i.push(a),r.slice(0,d)+k+r.slice(d)+A+c):r+A+(-2===d?t:c)}return[Y(e,o+(e[r]||"<?>")+(2===t?"</svg>":3===t?"</math>":"")),i]};class q{constructor({strings:e,_$litType$:t},r){let i;this.parts=[];let s=0,o=0;const n=e.length-1,a=this.parts,[l,d]=X(e,t);if(this.el=q.createElement(l,r),G.currentNode=this.el.content,2===t||3===t){const e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;null!==(i=G.nextNode())&&a.length<n;){if(1===i.nodeType){if(i.hasAttributes())for(const e of i.getAttributeNames())if(e.endsWith(k)){const t=d[o++],r=i.getAttribute(e).split(A),n=/([.?@])?(.*)/.exec(t);a.push({type:1,index:s,name:n[2],strings:r,ctor:"."===n[1]?ee:"?"===n[1]?te:"@"===n[1]?re:Q}),i.removeAttribute(e)}else e.startsWith(A)&&(a.push({type:6,index:s}),i.removeAttribute(e));if(O.test(i.tagName)){const e=i.textContent.split(A),t=e.length-1;if(t>0){i.textContent=C?C.emptyScript:"";for(let r=0;r<t;r++)i.append(e[r],T()),G.nextNode(),a.push({type:2,index:++s});i.append(e[t],T())}}}else if(8===i.nodeType)if(i.data===P)a.push({type:2,index:s});else{let e=-1;for(;-1!==(e=i.data.indexOf(A,e+1));)a.push({type:7,index:s}),e+=A.length-1}s++}}static createElement(e,t){const r=E.createElement("template");return r.innerHTML=e,r}}function K(e,t,r=e,i){if(t===j)return t;let s=void 0!==i?r._$Co?.[i]:r._$Cl;const o=H(t)?void 0:t._$litDirective$;return s?.constructor!==o&&(s?._$AO?.(!1),void 0===o?s=void 0:(s=new o(e),s._$AT(e,r,i)),void 0!==i?(r._$Co??=[])[i]=s:r._$Cl=s),void 0!==s&&(t=K(e,s._$AS(e,t.values),s,i)),t}class J{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:r}=this._$AD,i=(e?.creationScope??E).importNode(t,!0);G.currentNode=i;let s=G.nextNode(),o=0,n=0,a=r[0];for(;void 0!==a;){if(o===a.index){let t;2===a.type?t=new Z(s,s.nextSibling,this,e):1===a.type?t=new a.ctor(s,a.name,a.strings,this,e):6===a.type&&(t=new ie(s,this,e)),this._$AV.push(t),a=r[++n]}o!==a?.index&&(s=G.nextNode(),o++)}return G.currentNode=E,i}p(e){let t=0;for(const r of this._$AV)void 0!==r&&(void 0!==r.strings?(r._$AI(e,r,t),t+=r.strings.length-2):r._$AI(e[t])),t++}}class Z{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,r,i){this.type=2,this._$AH=F,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=r,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return void 0!==t&&11===e?.nodeType&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=K(this,e,t),H(e)?e===F||null==e||""===e?(this._$AH!==F&&this._$AR(),this._$AH=F):e!==this._$AH&&e!==j&&this._(e):void 0!==e._$litType$?this.$(e):void 0!==e.nodeType?this.T(e):(e=>z(e)||"function"==typeof e?.[Symbol.iterator])(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==F&&H(this._$AH)?this._$AA.nextSibling.data=e:this.T(E.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:r}=e,i="number"==typeof r?this._$AC(e):(void 0===r.el&&(r.el=q.createElement(Y(r.h,r.h[0]),this.options)),r);if(this._$AH?._$AD===i)this._$AH.p(t);else{const e=new J(i,this),r=e.u(this.options);e.p(t),this.T(r),this._$AH=e}}_$AC(e){let t=W.get(e.strings);return void 0===t&&W.set(e.strings,t=new q(e)),t}k(e){z(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let r,i=0;for(const s of e)i===t.length?t.push(r=new Z(this.O(T()),this.O(T()),this,this.options)):r=t[i],r._$AI(s),i++;i<t.length&&(this._$AR(r&&r._$AB.nextSibling,i),t.length=i)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const t=x(e).nextSibling;x(e).remove(),e=t}}setConnected(e){void 0===this._$AM&&(this._$Cv=e,this._$AP?.(e))}}class Q{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,r,i,s){this.type=1,this._$AH=F,this._$AN=void 0,this.element=e,this.name=t,this._$AM=i,this.options=s,r.length>2||""!==r[0]||""!==r[1]?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=F}_$AI(e,t=this,r,i){const s=this.strings;let o=!1;if(void 0===s)e=K(this,e,t,0),o=!H(e)||e!==this._$AH&&e!==j,o&&(this._$AH=e);else{const i=e;let n,a;for(e=s[0],n=0;n<s.length-1;n++)a=K(this,i[r+n],t,n),a===j&&(a=this._$AH[n]),o||=!H(a)||a!==this._$AH[n],a===F?e=F:e!==F&&(e+=(a??"")+s[n+1]),this._$AH[n]=a}o&&!i&&this.j(e)}j(e){e===F?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class ee extends Q{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===F?void 0:e}}class te extends Q{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==F)}}class re extends Q{constructor(e,t,r,i,s){super(e,t,r,i,s),this.type=5}_$AI(e,t=this){if((e=K(this,e,t,0)??F)===j)return;const r=this._$AH,i=e===F&&r!==F||e.capture!==r.capture||e.once!==r.once||e.passive!==r.passive,s=e!==F&&(r===F||i);i&&this.element.removeEventListener(this.name,this,r),s&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}}class ie{constructor(e,t,r){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(e){K(this,e)}}const se=w.litHtmlPolyfillSupport;se?.(q,Z),(w.litHtmlVersions??=[]).push("3.3.2");const oe=globalThis;class ne extends ${constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=((e,t,r)=>{const i=r?.renderBefore??t;let s=i._$litPart$;if(void 0===s){const e=r?.renderBefore??null;i._$litPart$=s=new Z(t.insertBefore(T(),e),e,void 0,r??{})}return s._$AI(e),s})(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return j}}ne._$litElement$=!0,ne.finalized=!0,oe.litElementHydrateSupport?.({LitElement:ne});const ae=oe.litElementPolyfillSupport;ae?.({LitElement:ne}),(oe.litElementVersions??=[]).push("4.2.2");const le=[{label:"Warm",rgb:[255,183,76]},{label:"Amber",rgb:[255,138,101]},{label:"Rose",rgb:[244,143,177]},{label:"Lavender",rgb:[179,157,219]},{label:"Sky",rgb:[129,212,250]},{label:"Mint",rgb:[165,214,167]}],de=le.map(e=>`rgb(${e.rgb.join(", ")})`),he=3700,ce="custom",ue="custom_temperature",ge="light_temperature",pe="light_rgb",me="legacy_adaptive",_e="spectrum",be="presets",fe="both",ve="title_outside_icon_inside",ye="icon_title_outside",$e=ge,we=fe,xe=ye,Ce="large",Se="var(--gray1000)",ke=!0,Ae=!1,Pe=100,Me={small:{trackHeight:16,handleHeight:28,handleWidth:4,splitGap:10,sliderPadding:6,bubbleSize:34,radius:8,iconSize:14},medium:{trackHeight:24,handleHeight:40,handleWidth:4,splitGap:12,sliderPadding:8,bubbleSize:38,radius:12,iconSize:18},large:{trackHeight:40,handleHeight:56,handleWidth:4,splitGap:14,sliderPadding:10,bubbleSize:40,radius:16,iconSize:20},xlarge:{trackHeight:56,handleHeight:68,handleWidth:4,splitGap:16,sliderPadding:12,bubbleSize:42,radius:16,iconSize:24},jumbo:{trackHeight:72,handleHeight:84,handleWidth:4,splitGap:20,sliderPadding:14,bubbleSize:46,radius:20,iconSize:28}},Ee=new Set(["brightness","color_temp","hs","xy","rgb","rgbw","rgbww","white"]),Te=new Set(["hs","xy","rgb","rgbw","rgbww"]);function He(e){if(Array.isArray(e?.color_presets)&&e.color_presets.length)return e.color_presets.map(e=>{const t=Array.isArray(e?.rgb)?e.rgb:Ne(e);return t?`rgb(${t.join(", ")})`:null}).filter(Boolean);const t=Array.from({length:6},(e,t)=>`preset_color_${t+1}`).map(t=>e?.[t]||"").filter(Boolean);return t.length?t:de}function ze(e){const t={...e||{}},r=He({color_presets:t.color_presets});var i,s;return t.size===Ce&&delete t.size,Be(t)===$e&&delete t.slider_color_mode,Re(t)===we&&delete t.color_control,Ve(t)===xe&&delete t.label_layout,t.icon_color===Se&&delete t.icon_color,t.hide_color_controls===ke&&delete t.hide_color_controls,t.hide_color_presets===Ae&&delete t.hide_color_presets,0===Number(t.brightness_min)&&delete t.brightness_min,Number(t.brightness_max)===Pe&&delete t.brightness_max,!1===t.hide_rgb_presets&&delete t.hide_rgb_presets,Array.isArray(t.color_presets)&&0===t.color_presets.length&&delete t.color_presets,i=r,s=de,Array.isArray(i)&&Array.isArray(s)&&i.length===s.length&&i.every((e,t)=>e===s[t])&&delete t.color_presets,t}function Ne(e){if(Array.isArray(e)&&e.length>=3)return e.slice(0,3).map(e=>Math.max(0,Math.min(255,Number(e)||0)));if("string"!=typeof e)return null;const t=e.trim(),r=t.match(/^#([\da-f]{3}|[\da-f]{6})$/i);if(r){const e=r[1];return 3===e.length?e.split("").map(e=>Number.parseInt(e+e,16)):[Number.parseInt(e.slice(0,2),16),Number.parseInt(e.slice(2,4),16),Number.parseInt(e.slice(4,6),16)]}const i=t.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);if(i)return i.slice(1,4).map(e=>Math.max(0,Math.min(255,Number(e))));const s=t.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);return s?s.slice(1,4).map(e=>Math.max(0,Math.min(255,Number(e)))):null}function Ue(e){return e?`mysmart-light-control:last-adaptive-color:${e}`:null}function Be(e){return e?.slider_color_mode?e.slider_color_mode:e?.adaptive_slider_color?me:$e}function Re(e){return[_e,be,fe].includes(e?.color_control)?e.color_control:we}function Ve(e){return[ve,ye].includes(e?.label_layout)?e.label_layout:xe}function Le(e,t=0){const r=Number(e);return Number.isFinite(r)?Math.max(0,Math.min(100,Math.round(r))):t}function De(e){const t=Le(e?.brightness_min,0),r=Le(e?.brightness_max,Pe);return r<t?{min:r,max:t}:{min:t,max:r}}class Oe extends ne{static get properties(){return{hass:{},_config:{state:!0}}}setConfig(e){this._config=this._withEditorDefaults(e)}_withEditorDefaults(e){const t=De(e);return{...e,size:e?.size||Ce,slider_color_mode:Be(e),color_control:Re(e),label_layout:Ve(e),icon_color:e?.icon_color??Se,hide_color_controls:e?.hide_color_controls??ke,hide_color_presets:!0===e?.hide_color_presets||!0===e?.hide_rgb_presets,brightness_min:t.min,brightness_max:t.max,color_presets:He(e)}}_stripDefaultConfig(e){return ze(e)}_updateConfig(e,t){const r={...this._config||{}};"slider_color_mode"===e&&delete r.adaptive_slider_color,"hide_color_presets"===e&&delete r.hide_rgb_presets,""===t||null==t||Array.isArray(t)&&0===t.length||"boolean"==typeof t&&"show_icon"===e&&!0===t||"boolean"==typeof t&&"show_name"===e&&!0===t||"boolean"==typeof t&&"show_brightness"===e&&!1===t||"boolean"==typeof t&&"force_toggle_mode"===e&&!1===t||"boolean"==typeof t&&"show_expand_toggle"===e&&!0===t||"boolean"==typeof t&&"hide_temperature_slider"===e&&!1===t||"boolean"==typeof t&&"hide_color_controls"===e&&t===ke||"boolean"==typeof t&&"hide_color_presets"===e&&t===Ae||"boolean"==typeof t&&"hide_rgb_presets"===e&&!1===t||"boolean"==typeof t&&"live_update"===e&&!1===t||"boolean"==typeof t&&"show_icon_on_small_sizes"===e&&!1===t||"brightness_min"===e&&0===Number(t)||"brightness_max"===e&&Number(t)===Pe||"label_layout"===e&&t===xe||"slider_color_mode"===e&&t===$e||"color_control"===e&&t===we||"icon_color"===e&&t===Se||"size"===e&&t===Ce?delete r[e]:r[e]=t;const i=this._stripDefaultConfig(r);this._config=this._withEditorDefaults(i),this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i},bubbles:!0,composed:!0}))}_valueChanged(e){const t=e.target,r=t.configValue;if(!r)return;let i=e.detail?.value??t.value;"checkbox"===t.type||"ha-switch"===t.localName?i=t.checked:"number"===t.type&&(i=Number(i)),this._updateConfig(r,i)}_presetValueChanged(e,t){const r=[...this._config?.color_presets||[]];r[e]=t,this._updateConfig("color_presets",r.filter(e=>e))}_addPreset(){const e=[...this._config?.color_presets||[]];e.push("#d7c3ff"),this._updateConfig("color_presets",e)}_removePreset(e){const t=[...this._config?.color_presets||[]];t.splice(e,1),this._updateConfig("color_presets",t)}_normalizeColorForPicker(e){const t=Ne(e);return t?`#${t.map(e=>e.toString(16).padStart(2,"0")).join("")}`:"#d7c3ff"}_getSliderColorMode(){return Be(this._config)}_renderColorField(e,t){return I`
      <ha-input
        .value=${this._config?.[t]||""}
        .configValue=${t}
        .label=${e}
        @input=${this._valueChanged}
      ></ha-input>
    `}_renderSelectSelector(e,t,r,i){return I`
      <ha-selector
        .hass=${this.hass}
        .selector=${{select:{mode:"dropdown",options:i}}}
        .value=${r}
        .configValue=${t}
        .label=${e}
        @value-changed=${this._valueChanged}
      ></ha-selector>
    `}render(){if(!this.hass)return I``;const e=Array.isArray(this._config?.color_presets)?this._config.color_presets:He(this._config),t=this._getSliderColorMode(),r=Re(this._config),i=Ve(this._config);return I`
      <div class="editor">
        <ha-selector
          .hass=${this.hass}
          .selector=${{entity:{domain:"light"}}}
          .value=${this._config?.entity||""}
          .configValue=${"entity"}
          .label=${"Light entity"}
          @value-changed=${this._valueChanged}
        ></ha-selector>

        <ha-input
          .value=${this._config?.name||""}
          .configValue=${"name"}
          label="Title (optional)"
          @input=${this._valueChanged}
        ></ha-input>

        <ha-icon-picker
          .hass=${this.hass}
          .value=${this._config?.icon||""}
          .configValue=${"icon"}
          label="Icon override"
          @value-changed=${this._valueChanged}
        ></ha-icon-picker>

        ${this._renderSelectSelector("Size","size",this._config?.size||Ce,[{value:"small",label:"Small"},{value:"medium",label:"Medium"},{value:"large",label:"Large"},{value:"xlarge",label:"Extra Large"},{value:"jumbo",label:"Jumbo"}])}

        ${this._renderSelectSelector("Label layout","label_layout",i,[{value:ve,label:"Title outside, icon inside slider"},{value:ye,label:"Icon and title outside slider"}])}

        <ha-formfield label="Show icon">
          <ha-switch
            .checked=${!1!==this._config?.show_icon}
            .configValue=${"show_icon"}
            @change=${this._valueChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield label="Show icon on small sizes">
          <ha-switch
            .checked=${!0===this._config?.show_icon_on_small_sizes}
            .configValue=${"show_icon_on_small_sizes"}
            @change=${this._valueChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield label="Show title">
          <ha-switch
            .checked=${!1!==this._config?.show_name}
            .configValue=${"show_name"}
            @change=${this._valueChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield label="Show state value">
          <ha-switch
            .checked=${!0===this._config?.show_brightness}
            .configValue=${"show_brightness"}
            @change=${this._valueChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-input
          .value=${String(this._config?.brightness_min??0)}
          .configValue=${"brightness_min"}
          label="Minimum brightness (%)"
          type="number"
          min="0"
          max="100"
          step="1"
          @input=${this._valueChanged}
        ></ha-input>

        <ha-input
          .value=${String(this._config?.brightness_max??Pe)}
          .configValue=${"brightness_max"}
          label="Maximum brightness (%)"
          type="number"
          min="0"
          max="100"
          step="1"
          @input=${this._valueChanged}
        ></ha-input>

        <ha-formfield label="Force toggle mode">
          <ha-switch
            .checked=${!0===this._config?.force_toggle_mode}
            .configValue=${"force_toggle_mode"}
            @change=${this._valueChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield label="Show expand chevron">
          <ha-switch
            .checked=${!1!==this._config?.show_expand_toggle}
            .configValue=${"show_expand_toggle"}
            @change=${this._valueChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield label="Live update while dragging">
          <ha-switch
            .checked=${!0===this._config?.live_update}
            .configValue=${"live_update"}
            @change=${this._valueChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield label="Hide expanded temperature slider">
          <ha-switch
            .checked=${!0===this._config?.hide_temperature_slider}
            .configValue=${"hide_temperature_slider"}
            @change=${this._valueChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield label="Hide expanded color slider">
          <ha-switch
            .checked=${!0===this._config?.hide_color_controls}
            .configValue=${"hide_color_controls"}
            @change=${this._valueChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield label="Hide expanded color presets">
          <ha-switch
            .checked=${!0===this._config?.hide_color_presets}
            .configValue=${"hide_color_presets"}
            @change=${this._valueChanged}
          ></ha-switch>
        </ha-formfield>

        ${this._renderSelectSelector("Expanded color controls","color_control",r,[{value:_e,label:"Spectrum slider"},{value:be,label:"Preset buttons"},{value:fe,label:"Spectrum and presets"}])}

        ${this._renderSelectSelector("Main slider color source","slider_color_mode",t,[{value:ce,label:"Custom colors"},{value:ue,label:"Custom temperature color"},{value:ge,label:"Match light temperature"},{value:pe,label:"Match light color"}])}

        ${t===ue?I`
          <ha-input
            .value=${String(this._config?.slider_color_temperature||he)}
            .configValue=${"slider_color_temperature"}
            label="Slider color temperature (K)"
            type="number"
            min="1000"
            max="40000"
            step="50"
            @input=${this._valueChanged}
          ></ha-input>
        `:""}

        <details class="panel">
          <summary>Farger</summary>
          <div class="panel-content">
            ${this._renderColorField("Bar foreground","bar_foreground")}
            ${this._renderColorField("Bar background","bar_background")}
            ${this._renderColorField("Card background","card_background")}
            ${this._renderColorField("Handle color","handle_color")}
            ${this._renderColorField("Popup number color","popup_number_color")}
            ${this._renderColorField("Icon color","icon_color")}
            ${this._renderColorField("Chevron color","chevron_color")}
          </div>
        </details>

        <details class="panel">
          <summary>Forhåndsvalg</summary>
          <div class="panel-content">
            ${e.map((e,t)=>I`
              <div class="preset-editor-row">
                <input
                  class="color-input"
                  type="color"
                  .value=${this._normalizeColorForPicker(e)}
                  @input=${e=>this._presetValueChanged(t,e.target.value)}
                />
                <ha-input
                  .value=${e}
                  label="Preset ${t+1}"
                  @input=${e=>this._presetValueChanged(t,e.target.value)}
                ></ha-input>
                <button class="remove-button" type="button" @click=${()=>this._removePreset(t)}>Remove</button>
              </div>
            `)}

            <button class="add-button" type="button" @click=${this._addPreset}>Add preset</button>
          </div>
        </details>
      </div>
    `}static get styles(){return o`
      .editor {
        display: grid;
        gap: 16px;
      }

      .panel {
        border: 1px solid var(--divider-color);
        border-radius: 14px;
        padding: 0 14px 14px;
      }

      .panel summary {
        cursor: pointer;
        color: var(--primary-text-color);
        font-weight: 500;
        padding: 14px 0;
      }

      .panel-content {
        display: grid;
        gap: 12px;
      }

      .preset-editor-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 12px;
        align-items: center;
      }

      .color-input {
        width: 42px;
        height: 42px;
        padding: 0;
        border: 1px solid var(--divider-color);
        border-radius: 10px;
        background: transparent;
      }

      .add-button,
      .remove-button {
        border: 1px solid var(--divider-color);
        background: var(--card-background-color);
        color: var(--primary-text-color);
        border-radius: 10px;
        font: inherit;
        padding: 10px 14px;
        cursor: pointer;
      }

      .add-button {
        justify-self: start;
      }
    `}}customElements.get("mysmart-light-control-editor")||customElements.define("mysmart-light-control-editor",Oe);class Ie extends ne{static get properties(){return{hass:{},config:{},_dragging:{state:!0},_dragValue:{state:!0},_pendingBrightness:{state:!0},_pendingSince:{state:!0},_expanded:{state:!0},_tempPreviewValue:{state:!0},_colorPreviewHue:{state:!0},_sliderColorSource:{state:!0},_sliderColorValue:{state:!0}}}constructor(){super(),this._dragging=!1,this._dragValue=null,this._pendingBrightness=null,this._pendingSince=0,this._expanded=!1,this._tempPreviewValue=null,this._colorPreviewHue=null,this._sliderColorSource=null,this._sliderColorValue=null,this._trackRect=null,this._lastBrightnessSentAt=0,this._brightnessTimer=null,this._previewUpdatedAt=0,this._lastAdaptiveColor=null,this._gestureMode=null,this._gesturePointerId=null,this._gestureStartX=0,this._gestureStartY=0,this._suppressNextClick=!1,this._moveHandler=this._handlePointerMove.bind(this),this._upHandler=this._handlePointerUp.bind(this)}disconnectedCallback(){super.disconnectedCallback(),this._teardownPointerListeners(),window.clearTimeout(this._brightnessTimer)}updated(e){if(super.updated(e),!e.has("hass")||!this.config?.entity)return;const t=this.hass?.states?.[this.config.entity];t&&(this._syncPendingBrightness(t),this._syncPreviewState(t))}_syncPendingBrightness(e){if(null==this._pendingBrightness)return;const t=null!=e.attributes.brightness?Number(e.attributes.brightness):"on"===e.state?255:0;if(Math.abs(t-this._pendingBrightness)<=2)return void this._clearPendingBrightness();Date.now()-this._pendingSince>1e4&&this._clearPendingBrightness()}_syncPreviewState(e){if(!this._sliderColorSource)return;const t=Date.now()-this._previewUpdatedAt;if(t>1e4)this._clearPreviewState();else{if("temp"===this._sliderColorSource){const r=Number(e.attributes.color_temp_kelvin);return!Number.isFinite(r)||r<=0?void(t>1500&&this._clearPreviewState()):void((Math.abs(r-Number(this._sliderColorValue))<=50||t>1500)&&this._clearPreviewState())}if("rgb"===this._sliderColorSource){const r=Array.isArray(e.attributes.rgb_color)?e.attributes.rgb_color.slice(0,3):this._hsColorToRgb(e.attributes.hs_color);if(!r)return void(t>1500&&this._clearPreviewState());(this._rgbArraysClose(r,this._sliderColorValue)||t>1500)&&this._clearPreviewState()}}}setConfig(e){if(!e.entity)throw new Error("You need to define a light entity");const t=He(e),r=this._loadStoredAdaptiveColor(e.entity),i=Be(e),s=Re(e),o=Ve(e),n=De(e),a=Number(e.slider_color_temperature);this.config={name:"",show_icon:!0,show_icon_on_small_sizes:!1,icon:"",size:Ce,label_layout:o,show_name:!0,show_brightness:!1,force_toggle_mode:!1,show_expand_toggle:!0,hide_temperature_slider:!1,hide_color_controls:ke,hide_color_presets:Ae,hide_rgb_presets:!1,brightness_min:0,brightness_max:Pe,color_control:s,live_update:!1,adaptive_slider_color:!1,slider_color_mode:i,slider_color_temperature:he,bar_background:"#5f5872",bar_foreground:"#d7c3ff",card_background:"transparent",handle_color:"#d7c3ff",popup_number_color:"#ffffff",icon_color:Se,chevron_color:"#bdb4d2",color_presets:t,...e,card_background:e.card_background??"transparent",icon_background:"transparent",slider_color_mode:i,color_control:s,label_layout:o,brightness_min:n.min,brightness_max:n.max,slider_color_temperature:Number.isFinite(a)&&a>0?a:he,color_presets:t},this._lastAdaptiveColor=r}static getConfigForm(){return{schema:[{name:"entity",required:!0,selector:{entity:{domain:"light"}}},{name:"name",selector:{text:{}}},{name:"icon",selector:{icon:{}}},{name:"size",selector:{select:{mode:"dropdown",options:[{value:"small",label:"Small"},{value:"medium",label:"Medium"},{value:"large",label:"Large"},{value:"xlarge",label:"Extra Large"},{value:"jumbo",label:"Jumbo"}]}}},{name:"show_icon",selector:{boolean:{}}},{name:"show_icon_on_small_sizes",selector:{boolean:{}}},{name:"label_layout",selector:{select:{mode:"dropdown",options:[{value:ve,label:"Title outside, icon inside slider"},{value:ye,label:"Icon and title outside slider"}]}}},{name:"show_name",selector:{boolean:{}}},{name:"show_brightness",selector:{boolean:{}}},{name:"brightness_min",selector:{number:{min:0,max:100,step:1,mode:"box"}}},{name:"brightness_max",selector:{number:{min:0,max:100,step:1,mode:"box"}}},{name:"force_toggle_mode",selector:{boolean:{}}},{name:"show_expand_toggle",selector:{boolean:{}}},{name:"hide_temperature_slider",selector:{boolean:{}}},{name:"hide_color_controls",selector:{boolean:{}}},{name:"hide_color_presets",selector:{boolean:{}}},{name:"color_control",selector:{select:{mode:"dropdown",options:[{value:_e,label:"Spectrum slider"},{value:be,label:"Preset buttons"},{value:fe,label:"Spectrum and presets"}]}}},{name:"live_update",selector:{boolean:{}}},{name:"slider_color_mode",selector:{select:{mode:"dropdown",options:[{value:ce,label:"Custom colors"},{value:ue,label:"Custom temperature / Kelvin"},{value:ge,label:"Light temperature"},{value:pe,label:"Light RGB"}]}}},{name:"slider_color_temperature",selector:{number:{min:1e3,max:4e4,step:50,mode:"box"}}},{name:"bar_background",selector:{text:{}}},{name:"bar_foreground",selector:{text:{}}},{name:"card_background",selector:{text:{}}},{name:"handle_color",selector:{text:{}}},{name:"icon_color",selector:{text:{}}},{name:"popup_number_color",selector:{text:{}}}],computeHelper:e=>"entity"===e.name?"Choose a light entity with brightness support.":"show_icon"===e.name?"Show the leading icon inside the active segment.":"show_icon_on_small_sizes"===e.name?"Show the icon on Small and Medium sliders. Off by default to keep those sizes cleaner.":"label_layout"===e.name?"Choose whether the slider icon stays inside the active segment or moves beside the title.":"force_toggle_mode"===e.name?"Render this card as a simple on/off toggle even when the light supports brightness.":"size"===e.name?"Slider thickness preset. Large and Extra Large are closest to your screenshot.":"show_expand_toggle"===e.name?"Show a chevron for lights with extra controls like color temperature or color.":"show_brightness"===e.name?"Show the current value in the header: brightness percent for sliders, On/Off state for switches.":"brightness_min"===e.name?"Minimum non-zero brightness sent by the slider, as a percent.":"brightness_max"===e.name?"Maximum brightness sent by the slider, as a percent.":"hide_temperature_slider"===e.name?"Hide the color temperature slider even for lights that support it.":"hide_color_controls"===e.name?"Hide the color spectrum slider even for lights that support color.":"hide_color_presets"===e.name?"Hide preset color buttons even for lights that support color.":"color_control"===e.name?"Choose how color-capable lights expose color controls.":"live_update"===e.name?"When enabled, brightness updates continuously while dragging. Off by default to reduce device traffic.":"slider_color_mode"===e.name?"Choose whether the slider uses your custom colors, a fixed Kelvin value, or the light temperature/RGB.":"slider_color_temperature"===e.name?"Only used when Slider color mode is set to Custom temperature / Kelvin.":void 0}}static async getConfigElement(){return document.createElement("mysmart-light-control-editor")}static getStubConfig(){return{entity:"light.living_room"}}getCardSize(){const e=this.hass?.states?.[this.config?.entity];if(e&&this._shouldRenderToggleMode(e))return 1;const t=!!e&&this._hasExtraControls(e),r=t&&!1!==this.config?.show_expand_toggle;return!t||r&&!this._expanded?2:3}render(){if(!this.hass||!this.config)return I``;const e=this.hass.states[this.config.entity];if(!e)return this._renderMessage(`Entity not found: ${this.config.entity}`);if(!e.entity_id?.startsWith("light."))return this._renderMessage(`${this.config.entity} is not a light entity.`);if(this._shouldRenderToggleMode(e))return this._renderToggleControl(e);const t=this._getDisplayBrightness(e),r=this._dragging?this._dragValue??t:t,i=this._percentFromBrightness(r),s="on"===e.state,o=this._isUnavailableState(e),n=this._hasExtraControls(e),a=n&&this.config.show_expand_toggle,l=n&&(!a||this._expanded),d=this.config.name||e.attributes.friendly_name||this.config.entity,h=this.config.icon||e.attributes.icon||"mdi:lightbulb",c=this.config.icon_color,u=Ve(this.config),g=!1!==this.config.show_icon&&(this.config.show_icon_on_small_sizes||!["small","medium"].includes(this.config.size)),p=g&&u===ye,m=g&&u===ve,_=this.config.show_brightness||o,b=this.config.show_name||_||p,f=this._getSizeMetrics(),v=[a?"":"no-expand"].join(" ").trim(),y=this._mainActiveWidth(i),$=this._mainInactiveWidth(y),w=this._mainHandleLeft(y),x=this._getSliderPalette(e),C=`\n      --mysmart-slider-card-background: transparent;\n      --mysmart-slider-bar-background: ${x.inactiveColor};\n      --mysmart-slider-bar-foreground: ${x.activeColor};\n      --mysmart-slider-handle-color: ${x.handleColor};\n      --mysmart-slider-popup-number-color: ${this.config.popup_number_color};\n      --mysmart-slider-popup-background: ${x.popupColor};\n      --mysmart-slider-popup-stem-color: ${x.popupColor};\n      --mysmart-slider-icon-background: transparent;\n      --mysmart-slider-icon-color: ${c};\n      --mysmart-slider-chevron-color: ${this.config.chevron_color};\n      --mysmart-slider-track-height: ${f.trackHeight}px;\n      --mysmart-slider-handle-height: ${f.handleHeight}px;\n      --mysmart-slider-handle-width: ${f.handleWidth}px;\n      --mysmart-slider-gap: ${f.splitGap}px;\n      --mysmart-slider-padding: ${f.sliderPadding}px;\n      --mysmart-slider-bubble-size: ${f.bubbleSize}px;\n      --mysmart-slider-radius: ${f.radius}px;\n      --mysmart-slider-inner-radius: ${Math.max(4,Math.round(.375*f.radius))}px;\n      --mysmart-slider-icon-size: ${f.iconSize}px;\n      --mysmart-secondary-gap: ${f.splitGap}px;\n    `;return I`
      <ha-card class="${o?"unavailable":""}" style="${C}">
        <div class="card-shell ${this._expanded?"expanded":""} ${o?"is-disabled":""}">
          ${b?I`
            <div class="slider-header">
              ${p||this.config.show_name?I`
                <div class="slider-label">
                  ${p?I`
                    <button
                      class="header-icon-button"
                      type="button"
                      @click=${this._handleIconClick}
                      title="${s?"Slå av":"Slå på"} ${d}"
                      aria-label="${s?"Slå av":"Slå på"} ${d}"
                      ?disabled=${o}
                    >
                      <ha-icon icon="${h}"></ha-icon>
                    </button>
                  `:""}
                  ${this.config.show_name?I`<div class="name" title="${d}">${d}</div>`:""}
                </div>
              `:I`<div></div>`}
              ${_?I`<div class="value-readout">${o?this._formatUnavailableState(e):`${i}%`}</div>`:""}
            </div>
          `:""}

          <div class="primary-row ${v}">
            <div class="slider-area">
              <div
                class="slider-track-shell ${o?"disabled":""}"
                @click=${this._handleTrackClick}
                @pointerdown=${this._handlePointerDown}
                @mousedown=${this._preventTrackMouseDown}
                aria-disabled="${o}"
              >
                <div class="value-bubble ${this._dragging?"visible":""}" style=${this._bubbleStyle(w)}>
                  <div class="value-bubble-label">${i}</div>
                  <div class="value-bubble-stem"></div>
                </div>

                <div class="slider-track">
                  <div class="slider-track-active" style="width: ${y};">
                    ${m?I`
                      <button
                        class="icon-button"
                        type="button"
                        @click=${this._handleIconClick}
                        title="${s?"Slå av":"Slå på"} ${d}"
                        aria-label="${s?"Slå av":"Slå på"} ${d}"
                        ?disabled=${o}
                      >
                        <ha-icon icon="${h}"></ha-icon>
                      </button>
                    `:""}
                  </div>
                  <div class="slider-track-inactive" style="width: ${$};"></div>
                  <button
                    class="slider-handle ${this._dragging?"dragging":""} ${null!=this._pendingBrightness?"pending":""}"
                    type="button"
                    style="left: ${w};"
                    aria-label="Lysstyrke"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow="${i}"
                    aria-valuetext="${i}% brightness"
                    aria-disabled="${o}"
                    ?disabled=${o}
                    role="slider"
                  ></button>
                </div>
              </div>
            </div>

            ${a?I`
              <button
                class="expand-button"
                type="button"
                @click=${this._toggleExpanded}
                title="${this._expanded?"Hide extra controls":"Show extra controls"}"
                aria-label="${this._expanded?"Hide extra controls":"Show extra controls"}"
                ?disabled=${o}
              >
                <ha-icon icon="${this._expanded?"mdi:chevron-up":"mdi:chevron-down"}"></ha-icon>
              </button>
            `:""}
          </div>

          ${l?this._renderExpandedControls(e):""}
        </div>
      </ha-card>
    `}_renderToggleControl(e){const t="on"===e.state,r=this._isUnavailableState(e),i=this.config.name||e.attributes.friendly_name||this.config.entity,s=this.config.icon||e.attributes.icon||"mdi:lightbulb",o=this._getSizeMetrics(),n=this._getSliderPalette(e),a=Ve(this.config),l=!1!==this.config.show_icon&&(this.config.show_icon_on_small_sizes||!["small","medium"].includes(this.config.size)),d=l&&a===ye,h=l&&a===ve,c=!0===this.config.show_brightness||r,u=!1!==this.config.show_name||d||c,g=this.config.card_background||"transparent",p=!this._isTransparentBackground(g),m=Math.max(8,o.sliderPadding),_=Math.max(10,Math.round(1.25*o.sliderPadding)),b=`\n      --mysmart-slider-card-background: transparent;\n      --mysmart-toggle-background: ${g};\n      --mysmart-slider-bar-background: ${n.inactiveColor};\n      --mysmart-slider-bar-foreground: ${n.activeColor};\n      --mysmart-slider-handle-color: ${n.handleColor};\n      --mysmart-slider-icon-color: ${this.config.icon_color};\n      --mysmart-slider-track-height: ${o.trackHeight}px;\n      --mysmart-slider-radius: ${o.radius}px;\n      --mysmart-slider-padding: ${o.sliderPadding}px;\n      --mysmart-slider-icon-size: ${o.iconSize}px;\n      --mysmart-slider-gap: ${o.splitGap}px;\n      --mysmart-toggle-track-inset: 4px;\n      --mysmart-toggle-padding-top: ${p?`${m}px`:"2px"};\n      --mysmart-toggle-padding-right: ${p?`${_}px`:"0px"};\n      --mysmart-toggle-padding-bottom: ${p?`${m}px`:"2px"};\n      --mysmart-toggle-padding-left: ${p?`${_}px`:"0px"};\n    `;return I`
      <ha-card class="${r?"unavailable":""}" style="${b}">
        <div class="toggle-card-shell ${p?"has-background":""} ${r?"is-disabled":""}">
          ${u?I`
            <div class="slider-header toggle-header">
              ${d||!1!==this.config.show_name?I`
                <div class="slider-label">
                  ${d?I`
                    <button
                      class="header-icon-button"
                      type="button"
                      @click=${this._handleIconClick}
                      title="${t?"Turn off":"Turn on"} ${i}"
                      aria-label="${t?"Turn off":"Turn on"} ${i}"
                      ?disabled=${r}
                    >
                      <ha-icon icon="${s}"></ha-icon>
                    </button>
                  `:""}
                  ${!1!==this.config.show_name?I`<div class="name" title="${i}">${i}</div>`:""}
                </div>
              `:I`<div></div>`}
              ${c?I`<div class="toggle-state-readout">${r?this._formatUnavailableState(e):t?"På":"Av"}</div>`:I`<div></div>`}
            </div>
          `:""}
          <button
            class="light-toggle-track ${t?"on":"off"} ${h?"with-icon":"without-icon"} ${r?"disabled":""}"
            type="button"
            @click=${this._handleToggleClick}
            role="switch"
            aria-checked="${t}"
            aria-disabled="${r}"
            aria-label="${t?"Turn off":"Turn on"} ${i}"
            title="${t?"Turn off":"Turn on"} ${i}"
            ?disabled=${r}
          >
            <span class="toggle-state-icons" aria-hidden="true">
              <span class="toggle-state-icon toggle-state-icon-left">
                <ha-icon icon="mdi:power-standby"></ha-icon>
              </span>
              <span class="toggle-state-icon toggle-state-icon-right">
                <span class="toggle-state-dot"></span>
              </span>
            </span>
            <span class="toggle-state-segment">
              ${h?I`<ha-icon icon="${s}"></ha-icon>`:""}
            </span>
          </button>
        </div>
      </ha-card>
    `}_renderExpandedControls(e){const t=this._shouldShowTemperatureControl(e),r=this._shouldShowColorSpectrum(e),i=this._shouldShowColorPresets(e);return I`
      <div class="secondary-panel">
        ${t?this._renderColorTempControl(e):""}
        ${r?this._renderColorSpectrum(e):""}
        ${i?this._renderColorPresets(e):""}
      </div>
    `}_renderColorTempControl(e){const t=this._isUnavailableState(e),r=Number(e.attributes.min_color_temp_kelvin||2e3),i=Number(e.attributes.max_color_temp_kelvin||6500),s=Number(this._tempPreviewValue||e.attributes.color_temp_kelvin||Math.round((r+i)/2)),o=Math.max(0,Math.min(100,(s-r)/(i-r)*100));return I`
      <div class="secondary-group">
        <div class="secondary-label-row">
          <span>Temperatur</span>
          <span>${s}K</span>
        </div>
        <div class="secondary-slider-shell">
          <div class="secondary-slider-track">
            <div class="secondary-slider-active" style="width: ${this._segmentWidth(o,100-o,"secondary")};"></div>
            <div class="secondary-slider-inactive" style="left: ${this._segmentLeft(o,"secondary")}; width: ${this._segmentWidth(100-o,o,"secondary")};"></div>
            <div class="secondary-slider-handle" style="left: ${o}%;"></div>
            <input
              class="secondary-range"
              type="range"
              min="${r}"
              max="${i}"
              step="50"
              aria-label="Temperatur"
              .value="${String(s)}"
              @input=${this._handleColorTempInput}
              @change=${this._handleColorTempChange}
              ?disabled=${t}
            />
          </div>
        </div>
      </div>
    `}_renderColorPresets(e){const t=this._isUnavailableState(e),r=this._getResolvedColorPresets();return I`
      <div class="secondary-group">
        <div class="secondary-label-row">
          <span>Forhåndsvalg</span>
          <span>Forhåndsvalg</span>
        </div>
        <div class="preset-row">
          ${r.map(e=>I`
            <button
              class="preset-chip"
              type="button"
              style="--preset-color: ${e.cssColor};"
              @click=${()=>this._setColorPreset(e.rgb)}
              title="${e.label}"
              aria-label="${e.label}"
              ?disabled=${t}
            ></button>
          `)}
        </div>
      </div>
    `}_renderColorSpectrum(e){const t=this._isUnavailableState(e),r=this._getDisplayHue(e),i=Math.max(0,Math.min(100,r/360*100)),s=this._getHueColorName(r);return I`
      <div class="secondary-group">
        <div class="secondary-label-row">
          <span>Farge</span>
          <span>${s}</span>
        </div>
        <div class="secondary-slider-shell">
          <div class="secondary-slider-track hue-slider-track">
            <div
              class="hue-slider-segment hue-slider-segment-active"
              style="${this._hueSegmentStyle("active",i)}"
            ></div>
            <div
              class="hue-slider-segment hue-slider-segment-inactive"
              style="${this._hueSegmentStyle("inactive",i)}"
            ></div>
            <div class="secondary-slider-handle hue-slider-handle" style="left: ${i}%;"></div>
            <input
              class="secondary-range"
              type="range"
              min="0"
              max="360"
              step="1"
              aria-label="Farge"
              .value="${String(Math.round(r))}"
              @input=${this._handleColorHueInput}
              @change=${this._handleColorHueChange}
              ?disabled=${t}
            />
          </div>
        </div>
      </div>
    `}_renderMessage(e){return I`
      <ha-card>
        <div class="message">${e}</div>
      </ha-card>
    `}_supportsBrightness(e){if(!e||!e.entity_id?.startsWith("light."))return!1;if(null!=e.attributes.brightness)return!0;return(e.attributes.supported_color_modes||[]).some(e=>Ee.has(e))}_isUnavailableState(e){return"unavailable"===e?.state||"unknown"===e?.state}_formatUnavailableState(e){return"unknown"===e?.state?"Ukjent":"Utilgjengelig"}_isCurrentEntityUnavailable(){const e=this.hass?.states?.[this.config?.entity];return this._isUnavailableState(e)}_shouldRenderToggleMode(e){return!0===this.config.force_toggle_mode||!this._supportsBrightness(e)}_supportsColorTemp(e){const t=e.attributes.supported_color_modes||[];return Boolean(t.includes("color_temp")||e.attributes.min_color_temp_kelvin||e.attributes.max_color_temp_kelvin||e.attributes.color_temp_kelvin)}_supportsColor(e){return(e.attributes.supported_color_modes||[]).some(e=>Te.has(e))}_shouldShowTemperatureControl(e){return!this.config.hide_temperature_slider&&this._supportsColorTemp(e)}_shouldShowColorSpectrum(e){const t=Re(this.config);return!this.config.hide_color_controls&&this._supportsColor(e)&&(t===_e||t===fe)}_shouldShowColorPresets(e){const t=Re(this.config);return!this.config.hide_color_presets&&!this.config.hide_rgb_presets&&this._supportsColor(e)&&(t===be||t===fe)}_hasExtraControls(e){return this._shouldShowTemperatureControl(e)||this._shouldShowColorSpectrum(e)||this._shouldShowColorPresets(e)}_getDisplayBrightness(e){return this._dragging&&null!=this._dragValue?this._dragValue:null!=this._pendingBrightness?this._pendingBrightness:null!=e.attributes.brightness?Number(e.attributes.brightness):"on"===e.state?255:0}_percentFromBrightness(e){return Math.max(0,Math.min(100,Math.round(Number(e||0)/255*100)))}_brightnessClampRange(){return De(this.config)}_brightnessFromClampPercent(e){return this._brightnessFromPercent(e)}_clampBrightness(e){const t=Number(e);if(!Number.isFinite(t)||t<=0)return 0;const r=this._brightnessClampRange(),i=this._brightnessFromClampPercent(r.min),s=this._brightnessFromClampPercent(r.max);return Math.max(i,Math.min(s,Math.round(t)))}_getMaxBrightness(){const e=this._brightnessClampRange();return this._brightnessFromClampPercent(e.max)}_getSizeMetrics(){return Me[this.config.size]||Me.large}_resolveSliderColor(e){const t=Be(this.config),r=this.config.bar_foreground,i=this._temperatureValueToCss(he)||r;if(t===ce)return{color:r,isAdaptive:!1};const s=this._getConfiguredSliderColor(e,t);return s?(this._setLastAdaptiveColor(s),{color:s,isAdaptive:!0}):t===ue||t===ge||t===me?{color:i,isAdaptive:!0}:{color:r,isAdaptive:!1}}_getSliderPalette(e){const{color:t,isAdaptive:r}=this._resolveSliderColor(e);if(Be(this.config)===ce||!r)return{activeColor:t,inactiveColor:this.config.bar_background,handleColor:this.config.handle_color,popupColor:this.config.handle_color};const i=Ne(t);if(!i)return{activeColor:t,inactiveColor:this.config.bar_background,handleColor:this.config.handle_color,popupColor:this.config.handle_color};const s=this._mixRgb(i,[0,0,0],.32);return{activeColor:t,inactiveColor:`rgba(${i.join(", ")}, 0.24)`,handleColor:s,popupColor:s}}_getConfiguredSliderColor(e,t=Be(this.config)){if(t===ue){const e=Number(this.config.slider_color_temperature);return this._temperatureValueToCss(Number.isFinite(e)&&e>0?e:he)}return t===ge?this._getOverrideSliderColor("temp",e)||this._getStateTemperatureColor(e)||this._lastAdaptiveColor:t===pe?this._getOverrideSliderColor("rgb",e)||this._getStateRgbColor(e)||this._lastAdaptiveColor:this._getOverrideSliderColor("rgb",e)||this._getOverrideSliderColor("temp",e)||this._getStateRgbColor(e)||this._getStateTemperatureColor(e)||this._lastAdaptiveColor}_getOverrideSliderColor(e,t){if(this._sliderColorSource!==e)return null;if("rgb"===e){return this._colorValueToCss(this._sliderColorValue)||this._getStateRgbColor(t)}if("temp"===e){return this._temperatureValueToCss(this._sliderColorValue)||this._getStateTemperatureColor(t)}return null}_getStateRgbColor(e){const t=Array.isArray(e?.attributes?.rgb_color)?e.attributes.rgb_color:this._hsColorToRgb(e?.attributes?.hs_color);return this._colorValueToCss(t)}_getStateTemperatureColor(e){const t=Number(e?.attributes?.color_temp_kelvin);return this._temperatureValueToCss(t)}_colorValueToCss(e){const t=Ne(e);return t?`rgb(${t.join(", ")})`:null}_temperatureValueToCss(e){const t=this._kelvinToRgb(e);return t?`rgb(${t.join(", ")})`:null}_setLastAdaptiveColor(e){e&&(this._lastAdaptiveColor=e,this._persistAdaptiveColor(e))}_loadStoredAdaptiveColor(e=this.config?.entity){const t=Ue(e);if(!t)return null;try{const e=window.localStorage.getItem(t);return this._colorValueToCss(e)}catch(e){return null}}_persistAdaptiveColor(e){const t=Ue(this.config?.entity);if(t)try{window.localStorage.setItem(t,e)}catch(e){}}_mixRgb(e,t,r){const i=Math.max(0,Math.min(1,Number(r)||0));return`rgb(${e.map((e,r)=>{const s=e+((t[r]||0)-e)*i;return Math.round(Math.max(0,Math.min(255,s)))}).join(", ")})`}_hsColorToRgb(e){if(!Array.isArray(e)||e.length<2)return null;const t=Number(e[0]),r=Math.max(0,Math.min(100,Number(e[1])||0))/100;if(!Number.isFinite(t))return null;const i=r,s=(t%360+360)%360/60,o=i*(1-Math.abs(s%2-1));let n=0,a=0,l=0;s>=0&&s<1?(n=i,a=o):s<2?(n=o,a=i):s<3?(a=i,l=o):s<4?(a=o,l=i):s<5?(n=o,l=i):(n=i,l=o);const d=1-i;return[n,a,l].map(e=>Math.round(255*(e+d)))}_hueToRgb(e){return this._hsColorToRgb([e,100])}_rgbToHue(e){const t=Ne(e);if(!t)return null;const[r,i,s]=t.map(e=>Math.max(0,Math.min(255,Number(e)))/255),o=Math.max(r,i,s),n=o-Math.min(r,i,s);if(0===n)return 0;let a;return a=o===r?(i-s)/n%6:o===i?(s-r)/n+2:(r-i)/n+4,Math.round((60*a%360+360)%360)}_kelvinToRgb(e){const t=Number(e);if(!Number.isFinite(t)||t<=0)return null;const r=Math.max(1e3,Math.min(4e4,t))/100;let i,s,o;return r<=66?(i=255,s=99.4708025861*Math.log(r)-161.1195681661):(i=329.698727446*Math.pow(r-60,-.1332047592),s=288.1221695283*Math.pow(r-60,-.0755148492)),o=r>=66?255:r<=19?0:138.5177312231*Math.log(r-10)-305.0447927307,[i,s,o].map(e=>{const t=Math.max(0,Math.min(255,e));return Math.round(t)})}_getResolvedColorPresets(){const e=(Array.isArray(this.config?.color_presets)?this.config.color_presets:[]).map((e,t)=>{const r=this._parseColorToRgb(e);return r?{label:`Preset ${t+1}`,rgb:r,cssColor:`rgb(${r.join(", ")})`}:null}).filter(Boolean);return e.length?e:this._defaultResolvedColorPresets()}_defaultResolvedColorPresets(){return le.map((e,t)=>({label:e.label||`Preset ${t+1}`,rgb:e.rgb,cssColor:`rgb(${e.rgb.join(", ")})`}))}_getDisplayHue(e){if(null!=this._colorPreviewHue)return this._clampHueSliderValue(this._colorPreviewHue);const t=Number(e?.attributes?.hs_color?.[0]);if(Number.isFinite(t))return this._normalizeHue(t);const r=this._rgbToHue(e?.attributes?.rgb_color);return null!=r?r:0}_normalizeHue(e){const t=Number(e);return Number.isFinite(t)?(t%360+360)%360:0}_clampHueSliderValue(e){const t=Number(e);return Number.isFinite(t)?Math.max(0,Math.min(360,t)):0}_getHueColorName(e){const t=this._normalizeHue(e);return t<15||t>=345?"Red":t<45?"Orange":t<75?"Yellow":t<150?"Green":t<195?"Cyan":t<255?"Blue":t<285?"Purple":t<330?"Magenta":"Pink"}_parseColorToRgb(e){return Ne(e)}_isTransparentBackground(e){if(null==e)return!0;const t=String(e).trim().toLowerCase();if(!t||"transparent"===t||"none"===t)return!0;if(/^#[0-9a-f]{4}$/i.test(t))return"0"===t.slice(-1);if(/^#[0-9a-f]{8}$/i.test(t))return"00"===t.slice(-2);const r=t.match(/^rgba?\([^)]*,\s*(0|0?\.0+)\s*\)$/i);return Boolean(r)}_brightnessFromPercent(e){return Math.max(0,Math.min(255,Math.round(Number(e)/100*255)))}_mainActiveWidth(e){const t="var(--mysmart-slider-gap)";return e<=0?"0px":e>=100?`max(0px, calc(100% - ${t}))`:`max(0px, calc(${`clamp(0%, ${e}%, 100%)`} - (${t} / 2)))`}_mainInactiveWidth(e){return`max(0px, calc(100% - (${e}) - var(--mysmart-slider-gap)))`}_mainHandleLeft(e){return`calc(${e} + (var(--mysmart-slider-gap) / 2))`}_segmentWidth(e,t,r="main"){return`max(0px, calc(clamp(0%, ${e}%, 100%) - ${e>0&&e<100||t>0&&t<100?`(${"secondary"===r?"var(--mysmart-secondary-gap)":"var(--mysmart-slider-gap)"} / 2)`:"0px"}))`}_segmentLeft(e,t="main"){return`calc(clamp(0%, ${e}%, 100%) + ${e>0&&e<100?`(${"secondary"===t?"var(--mysmart-secondary-gap)":"var(--mysmart-slider-gap)"} / 2)`:"0px"})`}_bubbleStyle(e){return`left: ${e};`}_hueSegmentStyle(e,t){if("active"===e){return`clip-path: inset(0 calc(100% - (${this._segmentWidth(t,100-t,"secondary")})) 0 0 round var(--mysmart-secondary-radius));`}return`clip-path: inset(0 0 0 ${this._segmentLeft(t,"secondary")} round var(--mysmart-secondary-radius));`}_preventTrackMouseDown(e){e.target===e.currentTarget&&e.preventDefault()}_toggleExpanded(){this._isCurrentEntityUnavailable()||(this._expanded=!this._expanded)}_handleIconClick(e){e.preventDefault(),e.stopPropagation(),this._toggleLight()}_handleToggleClick(e){e.preventDefault(),e.stopPropagation(),this._toggleLight()}_toggleLight(){const e=this.hass.states[this.config.entity];if(!e||this._isUnavailableState(e))return;if("on"===e.state)return void this.hass.callService("light","turn_off",{entity_id:this.config.entity});const t={entity_id:this.config.entity},r=this._supportsBrightness(e)?this._getMaxBrightness():null;null!=r&&r>0&&(t.brightness=r),this.hass.callService("light","turn_on",t)}_handleTrackClick(e){if(this._isCurrentEntityUnavailable())return;if(this._suppressNextClick)return this._suppressNextClick=!1,e.preventDefault(),void e.stopPropagation();if(this._dragging)return;if(e.composedPath().find(e=>e instanceof HTMLElement&&("BUTTON"===e.tagName||"INPUT"===e.tagName)))return;const t=this.shadowRoot.querySelector(".slider-track");if(!t)return;const r=t.getBoundingClientRect(),i=(e.clientX-r.left)/r.width*100,s=this._clampBrightness(this._brightnessFromPercent(i));this._setPendingBrightness(s),this._sendBrightness(s)}_handlePointerDown(e){if(this._isCurrentEntityUnavailable())return;if(null!=e.button&&0!==e.button)return;const t=e.composedPath().find(e=>e instanceof HTMLElement&&("BUTTON"===e.tagName||"INPUT"===e.tagName)),r=t?.classList?.contains("slider-handle");if(t&&!r)return;const i=this.shadowRoot.querySelector(".slider-track");i&&(this._trackRect=i.getBoundingClientRect(),this._gestureMode="pending",this._gesturePointerId=e.pointerId,this._gestureStartX=e.clientX,this._gestureStartY=e.clientY,window.addEventListener("pointermove",this._moveHandler),window.addEventListener("pointerup",this._upHandler),window.addEventListener("pointercancel",this._upHandler),"mouse"===e.pointerType&&(this._startBrightnessDrag(e.clientX),e.preventDefault(),e.stopPropagation()))}_handlePointerMove(e){if(null==this._gesturePointerId||e.pointerId===this._gesturePointerId){if("pending"===this._gestureMode){const t=e.clientX-this._gestureStartX,r=e.clientY-this._gestureStartY,i=Math.abs(t),s=Math.abs(r);if(Math.max(i,s)<8)return;if(s>i)return void this._cancelPendingGesture();this._startBrightnessDrag(e.clientX)}this._dragging&&(e.preventDefault(),this._updateDragBrightness(e.clientX))}}_handlePointerUp(e){if(null!=this._gesturePointerId&&e.pointerId!==this._gesturePointerId)return;if(!this._dragging)return void this._cancelPendingGesture();e.preventDefault();const t=this._dragValue??0;this._setPendingBrightness(t),this._sendBrightness(t),this._dragging=!1,this._dragValue=null,this._clearGestureState()}_teardownPointerListeners(){window.removeEventListener("pointermove",this._moveHandler),window.removeEventListener("pointerup",this._upHandler),window.removeEventListener("pointercancel",this._upHandler)}_startBrightnessDrag(e){this._gestureMode="dragging",this._dragging=!0,this._suppressNextClick=!0,this._updateDragBrightness(e)}_cancelPendingGesture(){this._dragging=!1,this._dragValue=null,this._clearGestureState()}_clearGestureState(){this._gestureMode=null,this._gesturePointerId=null,this._gestureStartX=0,this._gestureStartY=0,this._teardownPointerListeners()}_updateDragBrightness(e){if(!this._trackRect)return;const t=(e-this._trackRect.left)/this._trackRect.width*100,r=Math.max(0,Math.min(100,t)),i=this._clampBrightness(this._brightnessFromPercent(r));this._dragValue=i,this.config.live_update&&this._commitLiveBrightness(i)}_sendBrightness(e){if(this._isCurrentEntityUnavailable())return;this._lastBrightnessSentAt=Date.now(),window.clearTimeout(this._brightnessTimer);const t=this._clampBrightness(e);t<=0?this.hass.callService("light","turn_off",{entity_id:this.config.entity}):this.hass.callService("light","turn_on",{entity_id:this.config.entity,brightness:t})}_setPendingBrightness(e){this._pendingBrightness=this._clampBrightness(e),this._pendingSince=Date.now()}_clearPendingBrightness(){this._pendingBrightness=null,this._pendingSince=0}_commitLiveBrightness(e){if(Date.now()-this._lastBrightnessSentAt<90)return window.clearTimeout(this._brightnessTimer),void(this._brightnessTimer=window.setTimeout(()=>{this._sendBrightness(e)},90));this._sendBrightness(e)}_handleColorTempInput(e){if(this._isCurrentEntityUnavailable())return;const t=Number(e.target.value);this._tempPreviewValue=t,this._sliderColorSource="temp",this._sliderColorValue=t,this._previewUpdatedAt=Date.now()}_handleColorTempChange(e){if(this._isCurrentEntityUnavailable())return;const t=Number(e.target.value);this._tempPreviewValue=t,this._sliderColorSource="temp",this._sliderColorValue=t,this._previewUpdatedAt=Date.now(),this.hass.callService("light","turn_on",{entity_id:this.config.entity,color_temp_kelvin:t})}_handleColorHueInput(e){if(this._isCurrentEntityUnavailable())return;const t=this._clampHueSliderValue(e.target.value),r=this._hueToRgb(this._normalizeHue(t));this._tempPreviewValue=null,this._colorPreviewHue=t,this._sliderColorSource="rgb",this._sliderColorValue=r,this._previewUpdatedAt=Date.now()}_handleColorHueChange(e){if(this._isCurrentEntityUnavailable())return;const t=this._clampHueSliderValue(e.target.value),r=this._normalizeHue(t),i=this._hueToRgb(r);this._tempPreviewValue=null,this._colorPreviewHue=t,this._sliderColorSource="rgb",this._sliderColorValue=i,this._previewUpdatedAt=Date.now(),this.hass.callService("light","turn_on",{entity_id:this.config.entity,hs_color:[r,100]})}_setColorPreset(e){this._isCurrentEntityUnavailable()||(this._tempPreviewValue=null,this._colorPreviewHue=this._rgbToHue(e),this._sliderColorSource="rgb",this._sliderColorValue=Array.isArray(e)?e.slice(0,3):e,this._previewUpdatedAt=Date.now(),this.hass.callService("light","turn_on",{entity_id:this.config.entity,rgb_color:e}))}_clearPreviewState(){this._tempPreviewValue=null,this._colorPreviewHue=null,this._sliderColorSource=null,this._sliderColorValue=null,this._previewUpdatedAt=0}_rgbArraysClose(e,t){return!(!Array.isArray(e)||!Array.isArray(t)||e.length<3||t.length<3)&&e.slice(0,3).every((e,r)=>Math.abs(Number(e)-Number(t[r]))<=2)}static get styles(){return o`
      :host {
        --ha-card-background: transparent;
        --ha-card-border-width: 0;
        --ha-card-box-shadow: none;
        display: block;
      }

      ha-card {
        background: var(--mysmart-slider-card-background, transparent);
        border: none;
        box-shadow: none;
      }

      button {
        font: inherit;
      }

      button:disabled,
      input:disabled {
        cursor: not-allowed;
      }

      .is-disabled {
        opacity: 0.58;
      }

      .is-disabled .name,
      .is-disabled .value-readout,
      .is-disabled .toggle-state-readout,
      .is-disabled .secondary-label-row {
        color: var(--disabled-text-color, var(--secondary-text-color));
      }

      .slider-track-shell.disabled,
      .light-toggle-track.disabled {
        cursor: not-allowed;
      }

      .slider-track-shell.disabled .slider-track,
      .light-toggle-track.disabled,
      .secondary-range:disabled,
      .preset-chip:disabled {
        pointer-events: none;
      }

      .toggle-card-shell {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding:
          var(--mysmart-toggle-padding-top, 2px)
          var(--mysmart-toggle-padding-right, 0px)
          var(--mysmart-toggle-padding-bottom, 2px)
          var(--mysmart-toggle-padding-left, 0px);
        border-radius: var(--mysmart-slider-radius);
      }

      .toggle-card-shell.has-background {
        background: var(--mysmart-toggle-background, transparent);
      }

      .toggle-header {
        padding: 0;
      }

      .toggle-state-readout {
        color: var(--secondary-text-color);
        font-size: 0.88rem;
        font-weight: 500;
        letter-spacing: 0.01em;
      }

      .light-toggle-track {
        box-sizing: border-box;
        display: block;
        position: relative;
        width: 100%;
        height: var(--mysmart-slider-track-height);
        margin: 2px 0 0;
        padding: var(--mysmart-toggle-track-inset);
        border: none;
        border-radius: var(--mysmart-slider-radius);
        background: var(--mysmart-slider-bar-background, rgba(103, 80, 164, 0.18));
        color: var(--secondary-text-color);
        cursor: pointer;
        overflow: hidden;
        transition: background 160ms ease, filter 160ms ease, box-shadow 160ms ease;
      }

      .light-toggle-track.on {
        background: var(--mysmart-slider-bar-background, rgba(103, 80, 164, 0.18));
      }

      .light-toggle-track:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--mysmart-slider-bar-foreground, var(--primary-color)) 40%, transparent);
      }

      .toggle-state-icons,
      .toggle-state-segment {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
      }

      .toggle-state-icons {
        left: var(--mysmart-toggle-track-inset);
        right: var(--mysmart-toggle-track-inset);
        height: calc(100% - (var(--mysmart-toggle-track-inset) * 2));
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 calc(var(--mysmart-slider-padding) + 2px);
        color: color-mix(in srgb, var(--mysmart-slider-bar-foreground, var(--primary-color)) 80%, white 20%);
        z-index: 1;
        pointer-events: none;
      }

      .toggle-state-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: calc((var(--mysmart-slider-track-height) - (var(--mysmart-toggle-track-inset) * 2)) * 0.58);
        height: calc((var(--mysmart-slider-track-height) - (var(--mysmart-toggle-track-inset) * 2)) * 0.58);
      }

      .toggle-state-icon ha-icon {
        --mdc-icon-size: calc(var(--mysmart-slider-icon-size) * 0.8);
      }

      .toggle-state-segment {
        left: var(--mysmart-toggle-track-inset);
        width: calc((100% - (var(--mysmart-toggle-track-inset) * 2) + var(--mysmart-slider-gap)) / 2);
        height: calc(100% - (var(--mysmart-toggle-track-inset) * 2));
        background: var(--mysmart-slider-bar-background, rgba(103, 80, 164, 0.18));
        color: var(--mysmart-slider-icon-color, var(--primary-text-color));
        border-radius: max(6px, calc(var(--mysmart-slider-radius) - var(--mysmart-toggle-track-inset) - 2px));
        z-index: 2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transform: translateY(-50%);
        transition:
          left 180ms ease,
          background 180ms ease,
          color 180ms ease,
          transform 180ms ease;
      }

      .light-toggle-track.on .toggle-state-segment {
        left: calc(50% - (var(--mysmart-slider-gap) / 2));
        background: var(--mysmart-slider-bar-foreground, var(--primary-color));
        color: var(--card-background-color, #ffffff);
        z-index: 2;
      }

      .light-toggle-track.with-icon .toggle-state-segment ha-icon {
        --mdc-icon-size: var(--mysmart-slider-icon-size);
      }

      .light-toggle-track.without-icon .toggle-state-segment {
        border-radius: 12px;
      }

      .toggle-state-dot {
        width: calc(var(--mysmart-slider-track-height) * 0.18);
        height: calc(var(--mysmart-slider-track-height) * 0.18);
        border-radius: 50%;
        background: currentColor;
        opacity: 0.72;
      }

      .light-toggle-track:active .toggle-state-segment {
        transform: translateY(-50%) scale(0.98);
      }

      .card-shell {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 2px 0;
        --mysmart-secondary-track-height: 20px;
        --mysmart-secondary-handle-height: 34px;
        --mysmart-secondary-handle-width: 4px;
        --mysmart-secondary-radius: 10px;
      }

      .primary-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
      }

      .primary-row.no-expand {
        grid-template-columns: minmax(0, 1fr);
      }

      .icon-button,
      .header-icon-button,
      .expand-button {
        border: none;
        outline: none;
        cursor: pointer;
        flex: 0 0 auto;
      }

      .icon-button {
        position: absolute;
        top: 50%;
        left: calc(var(--mysmart-slider-padding) * 0.75);
        width: calc(var(--mysmart-slider-icon-size) + 10px);
        height: calc(var(--mysmart-slider-icon-size) + 10px);
        min-width: 18px;
        min-height: 18px;
        border-radius: 999px;
        background: var(--mysmart-slider-icon-background, rgba(103, 80, 164, 0.18));
        color: var(--mysmart-slider-icon-color, var(--primary-text-color));
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 160ms ease, background 160ms ease;
        transform: translateY(-50%);
        z-index: 2;
        pointer-events: auto;
      }

      .expand-button:active,
      .preset-chip:active {
        transform: scale(0.97);
      }

      .slider-handle:active {
        transform: translate(-50%, -50%) scale(0.97);
      }

      .icon-button:active {
        filter: brightness(0.96);
      }

      .header-icon-button:active {
        transform: scale(0.97);
      }

      .icon-button ha-icon,
      .header-icon-button ha-icon,
      .expand-button ha-icon {
        --mdc-icon-size: var(--mysmart-slider-icon-size);
      }

      .expand-button {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: transparent;
        color: var(--mysmart-slider-chevron-color, var(--secondary-text-color));
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: center;
      }

      .slider-area {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0;
        align-self: center;
      }

      .slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        min-width: 0;
        padding: 0 2px;
        margin-bottom: 0;
      }

      .slider-label {
        min-width: 0;
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      .header-icon-button {
        width: calc(var(--mysmart-slider-icon-size) + 8px);
        height: calc(var(--mysmart-slider-icon-size) + 8px);
        min-width: 24px;
        min-height: 24px;
        margin: 0;
        padding: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--mysmart-slider-icon-color, var(--primary-text-color));
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 160ms ease, filter 160ms ease;
      }

      .name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--primary-text-color);
        font-size: 1rem;
        font-weight: 500;
        letter-spacing: 0.0125em;
      }

      .value-readout {
        color: var(--secondary-text-color);
        font-size: 0.85rem;
      }

      .slider-track-shell {
        position: relative;
        padding: 0 0 4px;
        cursor: pointer;
        overflow: visible;
        touch-action: pan-y;
      }

      .slider-track {
        position: relative;
        height: var(--mysmart-slider-track-height);
        overflow: visible;
        touch-action: pan-y;
      }

      .slider-track-active {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        border-radius: var(--mysmart-slider-radius) var(--mysmart-slider-inner-radius) var(--mysmart-slider-inner-radius) var(--mysmart-slider-radius);
        background: var(--mysmart-slider-bar-foreground, var(--primary-color));
        overflow: hidden;
      }

      .slider-track-inactive {
        position: absolute;
        right: 0;
        top: 0;
        height: 100%;
        border-radius: var(--mysmart-slider-inner-radius) var(--mysmart-slider-radius) var(--mysmart-slider-radius) var(--mysmart-slider-inner-radius);
        background: var(--mysmart-slider-bar-background, rgba(103, 80, 164, 0.18));
      }

      .slider-handle {
        position: absolute;
        top: 50%;
        width: var(--mysmart-slider-handle-width);
        height: var(--mysmart-slider-handle-height);
        margin: 0;
        padding: 0;
        border: none;
        border-radius: 999px;
        background: var(--mysmart-slider-handle-color, #ffffff);
        box-sizing: border-box;
        appearance: none;
        -webkit-appearance: none;
        transform: translate(-50%, -50%);
        cursor: grab;
        touch-action: pan-y;
        z-index: 3;
      }

      .slider-handle.dragging {
        cursor: grabbing;
      }

      .slider-handle.pending:not(.dragging) {
        opacity: 0.88;
      }

      .value-bubble {
        position: absolute;
        top: calc((var(--mysmart-slider-bubble-size) * -1) - 10px);
        transform: translate(-50%, 0) scale(0.72);
        transform-origin: center bottom;
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease, transform 180ms ease;
        z-index: 5;
      }

      .value-bubble.visible {
        opacity: 1;
        transform: translate(-50%, 0) scale(1);
      }

      .value-bubble-label {
        width: var(--mysmart-slider-bubble-size);
        height: var(--mysmart-slider-bubble-size);
        padding: 0;
        border-radius: 50%;
        background: var(--mysmart-slider-popup-background, #211f26);
        color: var(--mysmart-slider-popup-number-color, #ffffff);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        font-weight: 500;
        line-height: 1;
      }

      .value-bubble-stem {
        display: none;
      }

      .secondary-panel {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 4px 0 0 0;
      }

      .secondary-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .secondary-label-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        color: var(--secondary-text-color);
        font-size: 0.82rem;
      }

      .secondary-range {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: pointer;
      }

      .secondary-slider-shell {
        position: relative;
      }

      .secondary-slider-track {
        position: relative;
        height: var(--mysmart-secondary-track-height);
      }

      .secondary-slider-track.hue-slider-track {
        border-radius: var(--mysmart-secondary-radius);
        overflow: visible;
      }

      .hue-slider-segment {
        position: absolute;
        inset: 0;
        border-radius: var(--mysmart-secondary-radius);
        background-image: linear-gradient(
          90deg,
          #ff0000 0%,
          #ffff00 16.66%,
          #00ff00 33.33%,
          #00ffff 50%,
          #0000ff 66.66%,
          #ff00ff 83.33%,
          #ff0000 100%
        );
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
        pointer-events: none;
        z-index: 1;
      }

      .secondary-slider-active,
      .secondary-slider-inactive {
        position: absolute;
        top: 0;
        height: 100%;
        border-radius: var(--mysmart-secondary-radius);
      }

      .secondary-slider-active {
        left: 0;
        background: var(--mysmart-slider-bar-foreground, var(--primary-color));
      }

      .secondary-slider-inactive {
        background: var(--mysmart-slider-bar-background, rgba(103, 80, 164, 0.18));
      }

      .secondary-slider-handle {
        position: absolute;
        top: 50%;
        width: var(--mysmart-secondary-handle-width);
        height: var(--mysmart-secondary-handle-height);
        border-radius: 999px;
        background: var(--mysmart-slider-handle-color, #ffffff);
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 2;
      }

      .hue-slider-handle {
        background: var(--primary-text-color, #ffffff);
        box-shadow:
          0 0 0 2px rgba(0, 0, 0, 0.42),
          0 1px 4px rgba(0, 0, 0, 0.32);
      }

      .preset-row {
        --preset-chip-size: var(--mysmart-secondary-track-height);
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        width: 100%;
      }

      .preset-chip {
        flex: 0 0 var(--preset-chip-size);
        width: var(--preset-chip-size);
        aspect-ratio: 1 / 1;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: var(--preset-color);
        cursor: pointer;
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.16),
          0 1px 3px rgba(0, 0, 0, 0.22);
      }

      .message {
        padding: 16px;
        color: var(--secondary-text-color);
      }

      @media (max-width: 480px) {
        .primary-row {
          gap: 10px;
        }

        .secondary-panel {
          padding-left: 0;
        }
      }
    `}}customElements.get("mysmart-light-control")||customElements.define("mysmart-light-control",Ie);
//# sourceMappingURL=mysmart-light-control.js.map
