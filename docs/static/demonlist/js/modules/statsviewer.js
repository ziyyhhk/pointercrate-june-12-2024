var _____WB$wombat$assign$function_____=function(name){return (globalThis._wb_wombat && globalThis._wb_wombat.local_init && globalThis._wb_wombat.local_init(name))||globalThis[name];};if(!globalThis.__WB_pmw){globalThis.__WB_pmw=function(obj){this.__WB_source=obj;return this;}}var window = _____WB$wombat$assign$function_____("window");
var self = _____WB$wombat$assign$function_____("self");
var document = _____WB$wombat$assign$function_____("document");
var location = _____WB$wombat$assign$function_____("location");
var top = _____WB$wombat$assign$function_____("top");
var parent = _____WB$wombat$assign$function_____("parent");
var frames = _____WB$wombat$assign$function_____("frames");
var opener = _____WB$wombat$assign$function_____("opener");
import{getCountryFlag,getSubdivisionFlag,populateSubdivisionDropdown}from "./demonlist.js";import{Dropdown,FilteredPaginator,findParentWithClass,get,Viewer}from "../../../core/js/modules/form.js";export class StatsViewer extends FilteredPaginator{constructor(html,statsviewerdata){super("stats-viewer-pagination",statsviewerdata.entryGenerator,"name_contains");this.endpoint=statsviewerdata.rankingEndpoint;this.retrievalEndpoint=statsviewerdata.retrievalEndpoint;this.currentLink=this.endpoint+"?"+$.param(this.queryData);this.html=html;this.output=new Viewer(html.getElementsByClassName("viewer-content")[0],this);this._name=document.getElementById("player-name");this._created=document.getElementById("created");this._beaten=document.getElementById("beaten");this._verified=document.getElementById("verified");this._published=document.getElementById("published");this._hardest=document.getElementById("hardest");this._score=document.getElementById("score");this._rank=document.getElementById("rank");this._amountBeaten=document.getElementById("stats");this._welcome=html.getElementsByClassName("viewer-welcome")[0];this._progress=document.getElementById("progress");this._content=html.getElementsByClassName("viewer-content")[0];let dropdownElement=html.getElementsByClassName("dropdown-menu")[0];if(dropdownElement!==undefined){this.dropdown=new Dropdown(dropdownElement);this.dropdown.addEventListener((selected)=>{if(selected==="International"){this.updateQueryData("nation",undefined);}else{this.updateQueryData("nation",selected);}});}}
initialize(){return get("/api/v1/list_information/").then(data=>{this.list_size=data.data['list_size'];this.extended_list_size=data.data['extended_list_size'];super.initialize()});}
setName(name,nationality){if(nationality===null){this._name.textContent=name;}else{while(this._name.lastChild){this._name.removeChild(this._name.lastChild);}
let nameSpan=document.createElement("span");nameSpan.style.padding="0 8px";nameSpan.innerText=name;this._name.appendChild(getCountryFlag(nationality.nation,nationality.country_code));this._name.appendChild(nameSpan);if(nationality.subdivision!==null){this._name.appendChild(getSubdivisionFlag(nationality.subdivision.name,nationality.country_code,nationality.subdivision.iso_code));}else{this._name.appendChild(document.createElement("span"));}}}
setHardest(hardest){if(this._hardest.lastChild)
this._hardest.removeChild(this._hardest.lastChild);this._hardest.appendChild(hardest===undefined?document.createTextNode("None"):this.formatDemon(hardest,"demonlist/demon.html?id=" + hardest.id));}
setCompletionNumber(main,extended,legacy){this._amountBeaten.textContent=main+" Main, "+extended+" Extended, "+legacy+" Legacy ";}
onReceive(response){super.onReceive(response);this._rank.innerHTML=this.currentlySelected.dataset.rank;this._score.innerHTML=this.currentlySelected.getElementsByTagName("i")[0].innerHTML;}
formatDemon(demon,link){var element;if(demon.position<=this.list_size){element=document.createElement("b");}else if(demon.position<=this.extended_list_size){element=document.createElement("span");}else{element=document.createElement("i");element.style.opacity=".5";}
if(link){let a=document.createElement("a");a.href=link;a.textContent=demon.name;element.appendChild(a);}else{element.textContent=demon.name;}
return element;}}
export function formatInto(parent,childs){while(parent.lastChild){parent.removeChild(parent.lastChild);}
if(childs.length){for(let child of childs){parent.appendChild(child);parent.appendChild(document.createTextNode(" - "));}
parent.removeChild(parent.lastChild);}else{parent.appendChild(document.createTextNode("None"));}}
export class InteractiveWorldMap{constructor(){this.wrapper=document.getElementById("world-map-wrapper");this.map=document.getElementById("world-map");this.svg=this.map.contentDocument.children[0];this.selectionListeners=[];this.deselectionListeners=[];this.zoom=1;this.translate={x:0,y:0};this.isDragging=false;this.dragDistance=0;this.relativeMousePosition={x:0,y:0};this.lastTouchPosition={x:0,y:0};this.setupTouchHandlers();this.setupMouseHandlers();this.currentlySelected=undefined;for(let subdivision of this.map.contentDocument.querySelectorAll(".land-with-states .state")){subdivision.addEventListener('click',event=>{event.stopPropagation();if(!findParentWithClass(subdivision,"continent").classList.contains("selectable"))
return;if(this.currentlySelected===subdivision){this._deselect();}else{this._select(subdivision);}});}
for(let clickable of this.map.contentDocument.querySelectorAll(".land, .island, .land-with-states")){clickable.addEventListener('click',()=>{if(!findParentWithClass(clickable,"continent").classList.contains("selectable"))
return;if(this.currentlySelected===clickable){this._deselect();}else{this._select(clickable);}})}}
addSelectionListener(listener){this.selectionListeners.push(listener);}
addDeselectionListener(listener){this.deselectionListeners.push(listener);}
highlightContinent(continentName){if(continentName===undefined){for(let continent of this.svg.getElementsByClassName("continent")){continent.classList.add("selectable");}}else{for(let continent of this.svg.getElementsByClassName("continent")){if(continent.id!==continentName.toLowerCase().replaceAll(' ',"-")){continent.classList.remove("selectable");}else{continent.classList.add("selectable");}}}}
resetContinentHighlight(){this.highlightContinent(undefined);}
select(nation,subdivision){let elementId=nation.toUpperCase();if(subdivision!==undefined)
elementId+="-"+subdivision.toUpperCase();let element=this.svg.getElementById(elementId)||this.svg.getElementById(elementId.toLowerCase());if(element!==undefined)
this._select(element,false);}
deselectSubdivision(){if(this.currentlySelected===undefined||!this.currentlySelected.id.includes("-"))
return;this.select(this.currentlySelected.id.substring(0,2));}
deselect(){this._deselect(false);}
showSubdivisions(){for(let divided of this.map.contentDocument.querySelectorAll(".land-with-states")){divided.classList.add("subdivided");}}
hideSubdivisions(){for(let divided of this.map.contentDocument.querySelectorAll(".land-with-states.subdivided")){divided.classList.remove("subdivided");}}
_select(clicked,fireEvents=true){if(this.isDragging)
return;if(this.currentlySelected!==undefined)
this.currentlySelected.classList.remove("selected");this.currentlySelected=clicked;this.currentlySelected.classList.add("selected");let subdivisionCode=clicked.id.substring(3);let countryCode=clicked.id.substring(0,2);if(fireEvents)
for(let listener of this.selectionListeners)
listener(countryCode.toUpperCase(),subdivisionCode===""?undefined:subdivisionCode.toUpperCase());}
_deselect(fireEvents=true){if(this.isDragging)
return
if(this.currentlySelected===undefined)
return;this.currentlySelected.classList.remove("selected");this.currentlySelected=undefined;if(fireEvents)
for(let listener of this.deselectionListeners)
listener();}
setLastPosFromTouchEvent(event){this.lastTouchPosition.x=event.touches[0].pageX;this.lastTouchPosition.y=event.touches[0].pageY;}
doDrag(deltaX,deltaY){if(deltaX===undefined||deltaY===undefined)
return;this.translate.x+=deltaX/this.zoom;this.translate.y+=deltaY/this.zoom;this.dragDistance+=Math.sqrt(this.translate.x*this.translate.x+this.translate.y*this.translate.y);this.svg.style.transform="scale("+this.zoom+") translate("+this.translate.x+"px, "+this.translate.y+"px)";}
setupTouchHandlers(){this.svg.addEventListener("touchstart",event=>{this.isDragging=event.touches.length===1;if(this.isDragging){this.setLastPosFromTouchEvent(event);event.preventDefault();}});this.svg.addEventListener("touchend",event=>{this.isDragging=event.touches.length!==1;if(this.isDragging){this.setLastPosFromTouchEvent(event);event.preventDefault();}});this.svg.addEventListener("touchmove",event=>{if(this.isDragging){this.doDrag(event.touches[0].pageX-this.lastTouchPosition.x,event.touches[0].pageY-this.lastTouchPosition.y);this.setLastPosFromTouchEvent(event);event.preventDefault();}});}
setupMouseHandlers(){document.addEventListener('scroll',()=>{let scrollRatio=window.scrollY/this.wrapper.clientHeight;this.wrapper.style.filter="blur("+(scrollRatio*.25)+"rem)";});this.svg.addEventListener("mousedown",event=>{this.isDragging=true;});this.svg.addEventListener("mousemove",event=>{if(this.isDragging)
this.doDrag(event.movementX,event.movementY);this.relativeMousePosition.x=event.clientX-this.svg.getBoundingClientRect().left+this.translate.x*this.zoom;this.relativeMousePosition.y=event.clientY-this.svg.getBoundingClientRect().top+this.translate.y*this.zoom;});this.svg.addEventListener("mouseleave",event=>{this.isDragging=false;});this.svg.addEventListener("mouseup",event=>{this.isDragging=false;if(this.dragDistance>=5){let captureClick=event=>{event.stopPropagation();this.svg.removeEventListener('click',captureClick,true);};this.svg.addEventListener('click',captureClick,true);}
this.dragDistance=0;});this.svg.addEventListener('wheel',event=>{if(event.shiftKey){let unzoomedMouseX=this.relativeMousePosition.x/this.zoom;let unzoomedMouseY=this.relativeMousePosition.y/this.zoom;if(this.zoom-event.deltaY/Math.abs(event.deltaY)*.1<0.2)
return;this.zoom-=event.deltaY/Math.abs(event.deltaY)*.1;let rezoomedMouseX=this.relativeMousePosition.x/this.zoom;let rezoomedMouseY=this.relativeMousePosition.y/this.zoom;this.translate.x+=(rezoomedMouseX-unzoomedMouseX);this.translate.y+=(rezoomedMouseY-unzoomedMouseY);this.svg.style.transform="scale("+this.zoom+") translate("+this.translate.x+"px, "+this.translate.y+"px)";}})}}
/*
     FILE ARCHIVED ON 02:34:53 Jun 15, 2024 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 02:30:55 Nov 08, 2026.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 0.423
  exclusion.robots: 0.045
  exclusion.robots.policy: 0.036
  esindex: 0.006
  cdx.remote: 12.401
  LoadShardBlock: 254.21 (3)
  PetaboxLoader3.resolve: 326.291 (5)
  PetaboxLoader3.datanode: 7432.28 (5)
  load_resource: 7946.074 (2)
*/