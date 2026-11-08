var _____WB$wombat$assign$function_____=function(name){return (globalThis._wb_wombat && globalThis._wb_wombat.local_init && globalThis._wb_wombat.local_init(name))||globalThis[name];};if(!globalThis.__WB_pmw){globalThis.__WB_pmw=function(obj){this.__WB_source=obj;return this;}}var window = _____WB$wombat$assign$function_____("window");
var self = _____WB$wombat$assign$function_____("self");
var document = _____WB$wombat$assign$function_____("document");
var location = _____WB$wombat$assign$function_____("location");
var top = _____WB$wombat$assign$function_____("top");
var parent = _____WB$wombat$assign$function_____("parent");
var frames = _____WB$wombat$assign$function_____("frames");
var opener = _____WB$wombat$assign$function_____("opener");
export class Dropdown{constructor(html){this.html=html;this.input=this.html.getElementsByTagName("input")[0];if(this.input.dataset.default===undefined)
this.input.placeholder="Click to select";this.menu=$(this.html.getElementsByClassName("menu")[0]);this.listeners=[];this.values={};for(let li of this.html.querySelectorAll("ul li")){li.addEventListener("click",()=>this.select(li.dataset.value));this.values[li.dataset.value]=li.dataset.display||li.innerHTML;}
const config={attributes:false,childList:true,subtree:false};const callback=(mutationList)=>{for(let mutation of mutationList){for(let removedLI of mutation.removedNodes){delete this.values[removedLI.dataset.value];}}};this.ul=this.html.getElementsByTagName("ul")[0];const observer=new MutationObserver(callback);observer.observe(this.ul,config);this.reset();var value;this.input.addEventListener("focus",()=>{value=this.input.value;this.input.value="";this.input.dispatchEvent(new Event("change"));this.menu.fadeTo(300,0.95);});this.input.addEventListener("focusout",()=>{this.menu.fadeOut(300);this.input.value=value;});}
addLI(li){this.ul.appendChild(li);li.addEventListener("click",()=>this.select(li.dataset.value));this.values[li.dataset.value]=li.dataset.display||li.innerHTML;}
clearOptions(){this.reset();while(this.ul.childNodes.length>1)
this.ul.removeChild(this.ul.lastChild);}
reset(){this.selected=this.input.dataset.default;if(this.values[this.selected])
this.input.value=this.values[this.selected];else
this.input.value=null;}
select(entry){if(entry in this.values){if(entry===this.selected)
return;this.selected=entry;this.input.value=this.values[entry];for(let listener of this.listeners){listener(entry);}}}
selectSilently(entry){if(entry in this.values){this.selected=entry;this.input.value=this.values[entry];}}
addEventListener(listener){this.listeners.push(listener);}}
export class Output{constructor(html){this.html=html;this.errorOutput=this.html.getElementsByClassName("output")[0];this.successOutput=this.html.getElementsByClassName("output")[1];}
setError(message,errorCode){if(this.successOutput)this.successOutput.style.display="none";if(this.errorOutput){if(message===null||message===undefined){this.errorOutput.style.display="none";}else{this.errorOutput.innerHTML=message;this.errorOutput.style.display="block";}}}
setSuccess(message){if(this.errorOutput)this.errorOutput.style.display="none";if(this.successOutput){if(message===null||message===undefined){this.successOutput.style.display="none";}else{this.successOutput.innerHTML=message;this.successOutput.style.display="block";}}}}
export class EditorBackend{url(){throw new Error("unimplemented");}
headers(){throw new Error("unimplemented");}
onSuccess(response){}
onError(response){}
edit(data){return patch(this.url(),this.headers(),data).then((response)=>{if(response.status==304){return true;}else{this.onSuccess(response);return false;}}).catch((response)=>{this.onError(response);throw response;});}}
export class PaginatorEditorBackend extends EditorBackend{constructor(paginator,shouldRefresh){super();this._paginator=paginator;this._shouldRefresh=shouldRefresh;}
headers(){return{"If-Match":this._paginator.currentEtag,};}
url(){return(this._paginator.retrievalEndpoint+
this._paginator.currentObject.id+
"/");}
onSuccess(response){this._paginator.onReceive(response);if(this._shouldRefresh){this._paginator.refresh();}}}
export function setupDropdownEditor(backend,dropdownId,field,output,translationTable={}){let dropdown=new Dropdown(document.getElementById(dropdownId));dropdown.addEventListener((selected)=>{let data={};if(Object.prototype.hasOwnProperty.call(translationTable,selected)){data[field]=translationTable[selected];}else{data[field]=selected;}
backend.edit(data).then(was304=>{if(was304)output.setSuccess("Nothing changed!");else output.setSuccess("Edit successful!");}).catch(response=>displayError(output)(response));});return dropdown;}
export class Dialog{constructor(dialogId){this.dialog=document.getElementById(dialogId);this.reject=undefined;this.resolve=undefined;this.submissionPredicateFactory=(data)=>new Promise(resolve=>resolve(data));this.dialog.getElementsByClassName("cross")[0].addEventListener("click",()=>{this.reject();this.close();})}
onSubmit(data){this.submissionPredicateFactory(data).then((data)=>{this.resolve(data);this.close();});}
open(){if(this.reject!==undefined)
throw new Error("Dialog is already open");$(this.dialog.parentNode).fadeIn(300);return new Promise((resolve,reject)=>{this.reject=reject;this.resolve=resolve;});}
close(){$(this.dialog.parentNode).fadeOut(300);this.reject=undefined;this.resolve=undefined;}}
export class FormDialog extends Dialog{constructor(dialogId){super(dialogId);this.form=new Form(this.dialog.getElementsByTagName("form")[0]);this.form.onSubmit(()=>this.onSubmit(this.form.serialize()));}}
export class DropdownDialog extends Dialog{constructor(dialogId,dropdownId){super(dialogId);this.dropdown=new Dropdown(document.getElementById(dropdownId));this.dropdown.addEventListener(selected=>this.onSubmit(selected));}}
export function setupEditorDialog(dialog,buttonId,backend,output,dataTransform=x=>x){document.getElementById(buttonId).addEventListener("click",()=>dialog.open());dialog.submissionPredicateFactory=(data)=>{return backend.edit(dataTransform(data)).then(was304=>{if(was304){output.setSuccess("Nothing changed");}else{output.setSuccess("Edit successful!");}}).catch(response=>{displayError(dialog.form)(response);throw response;});};}
export function setupFormDialogEditor(backend,dialogId,buttonId,output){let editor=new FormDialog(dialogId);setupEditorDialog(editor,buttonId,backend,output);return editor.form;}
export class Paginator extends Output{constructor(elementId,queryData,itemConstructor){super(document.getElementById(elementId));this.next=this.html.getElementsByClassName("next")[0];this.prev=this.html.getElementsByClassName("prev")[0];this.currentlySelected=null;this.currentObject=null;this.currentEtag=null;this.selectionListeners=[];this.endpoint=this.html.dataset.endpoint;this.retrievalEndpoint=this.endpoint;this.currentLink=this.endpoint+"?"+$.param(queryData);this.queryData=queryData;this.links=undefined;this.itemConstructor=itemConstructor;this.list=this.html.getElementsByClassName("selection-list")[0];this.nextHandler=this.onNextClick.bind(this);this.prevHandler=this.onPreviousClick.bind(this);if(this.html.style.display==="none"){this.html.style.display="block";}
this.next.addEventListener("click",this.nextHandler,false);this.prev.addEventListener("click",this.prevHandler,false);}
selectArbitrary(id){return get(this.retrievalEndpoint+id+"/").then(this.onReceive.bind(this));}
onSelect(selected){this.currentlySelected=selected;return this.selectArbitrary(selected.dataset.id).catch(displayError(this));}
onReceive(response){if(response.status!=204){if(response.status==200||response.status==201){this.currentObject=response.data.data;this.currentEtag=response.headers["etag"];}
for(let listener of this.selectionListeners){listener(this.currentObject);}}}
addSelectionListener(listener){this.selectionListeners.push(listener);}
initialize(){if(this.links===undefined)return this.refresh();}
handleResponse(response){this.links=parsePagination(response.headers["links"]);this.list.scrollTop=0;while(this.list.lastChild){this.list.removeChild(this.list.lastChild);}
for(var result of response.data){let item=this.itemConstructor(result);item.addEventListener("click",(e)=>this.onSelect(e.currentTarget));this.list.appendChild(item);}}
updateQueryData(key,value){let obj={};obj[key]=value;this.updateQueryData2(obj);}
updateQueryData2(obj){for(const[key,value]of Object.entries(obj)){if(value===undefined)delete this.queryData[key];else this.queryData[key]=value;}
this.currentLink=this.endpoint+"?"+$.param(this.queryData);this.refresh();}
setQueryData(queryData){this.queryData=queryData;this.currentLink=this.endpoint+"?"+$.param(queryData);this.refresh();}
refresh(){return get(this.currentLink).then(this.handleResponse.bind(this)).catch(displayError(this));}
onPreviousClick(){if(this.links.prev){get(this.links.prev).then(this.handleResponse.bind(this)).catch(displayError(this));}}
onNextClick(){if(this.links.next){get(this.links.next).then(this.handleResponse.bind(this)).catch(displayError(this));}}
stop(){this.next.removeEventListener("click",this.nextHandler,false);this.prev.removeEventListener("click",this.prevHandler,false);}}
function parsePagination(linkHeader){var links={};if(linkHeader){for(var link of linkHeader.split(",")){var s=link.split(";");links[s[1].substring(5)]=s[0].substring(1,s[0].length-1);}}
return links;}
export function findParentWithClass(element,clz){let parent=element;while(parent!==null&&parent.classList!==null){if(parent.classList.contains(clz)){return parent;}
parent=parent.parentNode;}}
export class Viewer extends Output{constructor(elementId,paginator){super(elementId);this.viewer=findParentWithClass(this.html,"viewer");this.paginator=paginator;this._welcome=this.viewer.getElementsByClassName("viewer-welcome")[0];this._content=this.viewer.getElementsByClassName("viewer-content")[0];this.paginator.addSelectionListener(()=>{this.setError(null);this.setSuccess(null);$(this._content).fadeIn(100);$(this._welcome).fadeOut(100);});}
hideContent(){$(this._welcome).fadeIn(100);$(this._content).fadeOut(100);}}
export class FilteredPaginator extends Paginator{constructor(paginatorID,itemConstructor,filterParam,initialQueryData={}){super(paginatorID,initialQueryData,itemConstructor);let filterInput=this.html.getElementsByTagName("input")[0];filterInput.value="";filterInput.addEventListener("keypress",(event)=>{if(event.keyCode==13){this.updateQueryData(filterParam,filterInput.value);}});filterInput.addEventListener("change",()=>this.updateQueryData(filterParam,filterInput.value));filterInput.parentNode.addEventListener("click",(event)=>{if(event.offsetX>filterInput.offsetWidth){filterInput.value="";this.updateQueryData(filterParam,"");}});var timeout=undefined;filterInput.addEventListener("input",()=>{if(timeout){clearTimeout(timeout);}
timeout=setTimeout(()=>this.updateQueryData(filterParam,filterInput.value),1000);});}}
export class FormInput{constructor(){this._clearOnInvalid=false;this._validators=[];}
addValidator(validator,msg){this._validators.push({validator:validator,message:msg,});}
addValidators(validators){Object.keys(validators).forEach((message)=>this.addValidator(validators[message],message));}
validate(){this.errorText="";var isValid=true;for(var validator of this._validators){if(!validator.validator(this)){isValid=false;if(typeof validator.message==="string"){this.appendError(validator.message);}else{this.appendError(validator.message(this.value));}}}
return isValid;}
clear(){throw new Error("Unimplemented");}
set clearOnInvalid(value){this._clearOnInvalid=value;}
get clearOnInvalid(){return this._clearOnInvalid;}
get value(){throw new Error("Abstract Property");}
set value(value){throw new Error("Abstract Property");}
get name(){throw new Error("Abstract Property");}
get id(){throw new Error("Abstract Property");}
get required(){return true;}
get errorText(){return "";}
set errorText(value){if(this.clearOnInvalid&&value)
this.clear();}
appendError(newError){if(this.error){if(this.errorText!=""){this.errorText+="<br>";}
this.errorText+=newError;}}}
export class HtmlFormInput extends FormInput{constructor(span){super();this.span=span;this.input=span.getElementsByTagName("input")[0]||span.getElementsByTagName("textarea")[0];this.error=span.getElementsByTagName("p")[0];this.input.addEventListener("input",()=>{if(this.input.validity.valid||this.input.validity.customError){this.errorText="";}},false);}
get value(){switch(this.input.type){case "checkbox":return this.input.checked;case "number":if(this.input.value===""||this.input.value===null)return null;return parseInt(this.input.value);case "text":default:if(this.input.value===""||this.input.value===null)return null;return this.input.value;}}
set value(value){if(this.input.type==="checkbox")
this.input.checked=value;else
this.input.value=value;}
get name(){return this.input.name;}
get id(){return this.span.id;}
clear(){if(this.input.type==="checkbox")
this.input.checked=false;else
this.input.value="";}
get required(){return this.input.hasAttribute("required");}
get errorText(){return this.error.innerHTML;}
set errorText(value){super.errorText=value;if(this.error)
this.error.innerHTML=value;else if(value!=="")
console.log("Unreportable error on input "+this.input+": "+value);this.input.setCustomValidity(value);}}
export class DropdownFormInput extends FormInput{constructor(dropdown){super();this.dropdown=new Dropdown(dropdown.getElementsByClassName("dropdown-menu")[0]);this.error=dropdown.getElementsByTagName("p")[0];this.dropdown.addEventListener(selected=>{if(this.input.validity.valid||this.input.validity.customError){this.errorText="";}});}
get input(){return this.dropdown.input;}
clear(){this.dropdown.reset();}
get value(){let asInt=parseInt(this.dropdown.selected);return isNaN(asInt)?this.dropdown.selected:asInt;}
get name(){return this.dropdown.input.name;}
get id(){return this.dropdown.html.id;}
get errorText(){return this.error.innerHTML;}
set errorText(value){super.errorText=value;this.error.innerHTML=value;this.dropdown.input.setCustomValidity(value);}}
export class HtmlInput extends FormInput{constructor(input){super();this.input=input;this.default=input.dataset.default;this.target=document.getElementById(input.dataset.targetId);this.error=input.getElementsByTagName("p")[0];let mutationObserver=new MutationObserver(()=>this.errorText="");mutationObserver.observe(this.target,{attributes:true,childList:true,subtree:true});}
clear(){this.target.innerText=this.default;}
get value(){return this.target.innerText===this.default?undefined:this.target.innerText;}
set value(value){this.target.innerText=value;}
get name(){return this.target.dataset.name;}
get id(){return this.input.id;}
get errorText(){return this.error.innerHTML;}
set errorText(value){super.errorText=value;this.error.innerHTML=value;}}
export class Form extends Output{constructor(form){super(form);this.inputs=[];this.submitHandler=undefined;this.invalidHandler=undefined;this.errorOutput=this.html.getElementsByClassName("output")[0];this.successOutput=this.html.getElementsByClassName("output")[1];this._errorRedirects={};for(var input of this.html.getElementsByClassName("form-input")){if(input.dataset.type==='dropdown')
this.inputs.push(new DropdownFormInput(input));else if(input.dataset.type==="html")
this.inputs.push(new HtmlInput(input))
else
this.inputs.push(new HtmlFormInput(input));}
this.html.addEventListener("submit",(event)=>{event.preventDefault();this.setError(null);this.setSuccess(null);var isValid=true;for(let input of this.inputs){isValid&=input.validate();}
if(isValid){if(this.submitHandler!==undefined){this.submitHandler(event);}}else if(this.invalidHandler!==undefined){this.invalidHandler();}},false);}
clear(){for(let input of this.inputs){input.clear();}}
addErrorOverride(errorCode,inputId){this._errorRedirects[errorCode]=inputId;}
serialize(){let data={};for(let input of this.inputs){if(input.name&&(input.value!==null||!input.required)){data[input.name]=input.value;}}
return data;}
setError(message,errorCode){if(this.successOutput)this.successOutput.style.display="none";if(this.errorOutput){if(message===null||message===undefined){this.errorOutput.style.display="none";}else{if(errorCode in this._errorRedirects){let input=this.input(this._errorRedirects[errorCode]);if(input){input.errorText=message;}else{this.errorOutput.style.display="block";this.errorOutput.innerHTML=message;}}else{this.errorOutput.style.display="block";this.errorOutput.innerHTML=message;}}}}
onSubmit(handler){this.submitHandler=handler;}
onInvalid(handler){this.invalidHandler=handler;}
input(id){for(var input of this.inputs){if(input.id==id){return input;}}
return null;}
value(id){this.input(id).value();}
addValidators(validators){Object.keys(validators).forEach((input_id)=>this.input(input_id).addValidators(validators[input_id]));}}
export function badInput(input){return!input.input.validity.badInput;}
export function patternMismatch(input){return!input.input.validity.patternMismatch;}
export function rangeOverflow(input){return!input.input.validity.rangeOverflow;}
export function rangeUnderflow(input){return!input.input.validity.rangeUnderflow;}
export function stepMismatch(input){return!input.input.validity.stepMismatch;}
export function tooLong(input){return!input.input.validity.tooLong;}
export function tooShort(input){return!input.input.validity.tooShort;}
export function typeMismatch(input){return!input.input.validity.typeMismatch;}
export function valueMissing(input){if(input.input===undefined||input.input.validity===undefined)
return input.value!==undefined;return!input.input.validity.valueMissing;}
export function displayError(output,specialCodes={}){return function(response){if(response.data){if(response.data.code in specialCodes){specialCodes[response.data.code](response.data);}else{output.setError(response.data.message,response.data.code);}}else{output.setError("FrontEnd JavaScript Error. Please notify an administrator and tell them as accurately as possible how to replicate this bug!");throw new Error("FrontendError");}};}
export function get(endpoint,headers={}){return mkReq("GET",endpoint,headers);}
export function post(endpoint,headers={},data={}){return mkReq("POST",endpoint,headers,data);}
export function put(endpoint,headers={},data={}){return mkReq("PUT",endpoint,headers,data);}
export function del(endpoint,headers={}){return mkReq("DELETE",endpoint,headers);}
export function patch(endpoint,headers,data){return mkReq("PATCH",endpoint,headers,data);}
const SEVERE_ERROR={message:"Severe internal server error: The error response could not be processed. This is most likely due to an internal panic in the request handler and might require a restart! Please report this immediately!",code:50000,data:null,};const UNEXPECTED_REDIRECT={message:"Unexpected redirect. This is a front-end error, most likely caused by a missing trailing slash",code:50000,data:null,};const RATELIMITED={message:"You have hit a Cloudflare ratelimit. Please wait a short time and try again.",code:42900,data:null}
function mkReq(method,endpoint,headers={},data=null){headers["Content-Type"]="application/json";headers["Accept"]="application/json";let csrf_meta=document.querySelector('meta[name="csrf_token"]');if(csrf_meta)
headers["X-CSRF-TOKEN"]=csrf_meta.content;return new Promise(function(resolve,reject){let xhr=new XMLHttpRequest();xhr.open(method,endpoint);xhr.onload=()=>{if((xhr.status>=200&&xhr.status<300)||xhr.status==304){resolve({data:xhr.status!=204&&xhr.status!=304&&xhr.responseText?JSON.parse(xhr.responseText):null,headers:parseHeaders(xhr),status:xhr.status,});}else if(xhr.status<400){reject({data:UNEXPECTED_REDIRECT,headers:parseHeaders(xhr),status:xhr.status,});}else{try{var jsonError=JSON.parse(xhr.responseText);}catch(e){return reject({data:xhr.status==429?RATELIMITED:SEVERE_ERROR,headers:parseHeaders(xhr),status:xhr.status,});}
reject({data:jsonError,headers:parseHeaders(xhr),status:xhr.status,});}};for(let header of Object.keys(headers)){xhr.setRequestHeader(header,headers[header]);}
if(data){data=JSON.stringify(data);}
xhr.send(data);});}
function parseHeaders(xhr){return xhr.getAllResponseHeaders().split("\r\n").reduce((result,current)=>{let[name,value]=current.split(": ");result[name]=value;return result;},{});}
/*
     FILE ARCHIVED ON 17:33:13 Jun 12, 2024 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 02:35:47 Nov 08, 2026.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 0.473
  exclusion.robots: 0.05
  exclusion.robots.policy: 0.038
  esindex: 0.008
  cdx.remote: 12.919
  LoadShardBlock: 79.718 (3)
  PetaboxLoader3.datanode: 12377.719 (7)
  PetaboxLoader3.resolve: 206.027 (5)
  load_resource: 13184.888 (4)
  revisit.resolve: 12249.538
*/