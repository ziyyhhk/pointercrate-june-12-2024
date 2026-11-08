var _____WB$wombat$assign$function_____=function(name){return (globalThis._wb_wombat && globalThis._wb_wombat.local_init && globalThis._wb_wombat.local_init(name))||globalThis[name];};if(!globalThis.__WB_pmw){globalThis.__WB_pmw=function(obj){this.__WB_source=obj;return this;}}var window = _____WB$wombat$assign$function_____("window");
var self = _____WB$wombat$assign$function_____("self");
var document = _____WB$wombat$assign$function_____("document");
var location = _____WB$wombat$assign$function_____("location");
var top = _____WB$wombat$assign$function_____("top");
var parent = _____WB$wombat$assign$function_____("parent");
var frames = _____WB$wombat$assign$function_____("frames");
var opener = _____WB$wombat$assign$function_____("opener");
import{Dropdown}from "../../../core/js/modules/form.js";import{getCountryFlag,populateSubdivisionDropdown}from "../modules/demonlist.js";import{formatInto,InteractiveWorldMap,StatsViewer}from "../modules/statsviewer.js";class IndividualStatsViewer extends StatsViewer{constructor(html){super(html,{retrievalEndpoint:"/api/v1/players/",rankingEndpoint:"/api/v1/players/ranking/",entryGenerator:generateStatsViewerPlayer});}
onReceive(response){super.onReceive(response);var playerData=response.data.data;this.setName(playerData.name,playerData.nationality);this.formatDemonsInto(this._created,playerData.created);this.formatDemonsInto(this._published,playerData.published);this.formatDemonsInto(this._verified,playerData.verified);let beaten=playerData.records.filter((record)=>record.progress===100);beaten.sort((r1,r2)=>r1.demon.name.localeCompare(r2.demon.name));let legacy=beaten.filter((record)=>record.demon.position>this.extended_list_size).length;let extended=beaten.filter((record)=>record.demon.position>this.list_size&&record.demon.position<=this.extended_list_size).length;let verifiedExtended=playerData.verified.filter(demon=>demon.position<=this.extended_list_size&&demon.position>this.list_size).length;let verifiedLegacy=playerData.verified.filter(demon=>demon.position>this.extended_list_size).length;this.formatRecordsInto(this._beaten,beaten);this.setCompletionNumber(beaten.length-legacy-extended+playerData.verified.length-verifiedExtended-verifiedLegacy,extended+verifiedExtended,legacy+verifiedLegacy);let hardest=playerData.verified.concat(beaten.map((record)=>record.demon)).reduce((acc,next)=>(acc.position>next.position?next:acc),{name:"None",position:321321321321});this.setHardest(hardest.name==="None"?undefined:hardest);let non100Records=playerData.records.filter((record)=>record.progress!==100).sort((r1,r2)=>r1.progress-r2.progress);this.formatRecordsInto(this._progress,non100Records);}
formatDemonsInto(element,demons){formatInto(element,demons.map(demon=>this.formatDemon(demon,"demonlist/demon.html?id=" + demon.id)));}
formatRecordsInto(element,records){formatInto(element,records.map(record=>{let demon=this.formatDemon(record.demon,record.video??("demonlist/demon.html?id=" + record.demon.id));if(record.progress!==100){demon.appendChild(document.createTextNode(" ("+record.progress+"%)"));}
return demon;}));}}
$(window).on("load",function(){let map=new InteractiveWorldMap();map.showSubdivisions();let subdivisionCheckbox=document.getElementById("show-subdivisions-checkbox");subdivisionCheckbox.addEventListener('change',()=>{if(subdivisionCheckbox.checked)
map.showSubdivisions();else
map.hideSubdivisions();});window.statsViewer=new IndividualStatsViewer(document.getElementById("statsviewer"));window.statsViewer.initialize();new Dropdown(document.getElementById("continent-dropdown")).addEventListener(selected=>{if(selected==="All"){window.statsViewer.updateQueryData("continent",undefined);map.resetContinentHighlight();}else{window.statsViewer.updateQueryData("continent",selected);map.highlightContinent(selected);}});let subdivisionDropdown=new Dropdown(document.getElementById("subdivision-dropdown"));subdivisionDropdown.addEventListener(selected=>{if(selected==='None'){map.deselectSubdivision();statsViewer.updateQueryData('subdivision',undefined);}else{let countryCode=statsViewer.queryData['nation'];map.select(countryCode,selected);statsViewer.updateQueryData2({nation:countryCode,subdivision:selected});}});statsViewer.dropdown.addEventListener(selected=>{if(selected==='International'){map.deselect();}else{map.select(selected);}
populateSubdivisionDropdown(subdivisionDropdown,selected);statsViewer.updateQueryData('subdivision',undefined);});map.addSelectionListener((countryCode,subdivisionCode)=>{populateSubdivisionDropdown(subdivisionDropdown,countryCode).then(()=>subdivisionDropdown.selectSilently(subdivisionCode));statsViewer.dropdown.selectSilently(countryCode);statsViewer.updateQueryData2({nation:countryCode,subdivision:subdivisionCode});});map.addDeselectionListener(()=>{statsViewer.dropdown.selectSilently("International");subdivisionDropdown.clearOptions();statsViewer.updateQueryData2({nation:undefined,subdivision:undefined});});});function generateStatsViewerPlayer(player){var li=document.createElement("li");var b=document.createElement("b");var i=document.createElement("i");li.className="white hover";li.dataset.id=player.id;li.dataset.rank=player.rank;b.appendChild(document.createTextNode("#"+player.rank+" "));i.appendChild(document.createTextNode(player.score.toFixed(2)));if(player.nationality){li.appendChild(getCountryFlag(player.nationality.nation,player.nationality.country_code));li.appendChild(document.createTextNode(" "));}
li.appendChild(b);li.appendChild(document.createTextNode(player.name));li.appendChild(i);return li;}
/*
     FILE ARCHIVED ON 02:34:53 Jun 15, 2024 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 02:31:05 Nov 08, 2026.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 0.459
  exclusion.robots: 0.058
  exclusion.robots.policy: 0.048
  esindex: 0.006
  cdx.remote: 9.36
  LoadShardBlock: 159.763 (3)
  PetaboxLoader3.datanode: 5118.273 (5)
  PetaboxLoader3.resolve: 3094.73 (3)
  load_resource: 8708.009 (2)
*/