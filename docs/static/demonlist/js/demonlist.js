var _____WB$wombat$assign$function_____=function(name){return (globalThis._wb_wombat && globalThis._wb_wombat.local_init && globalThis._wb_wombat.local_init(name))||globalThis[name];};if(!globalThis.__WB_pmw){globalThis.__WB_pmw=function(obj){this.__WB_source=obj;return this;}}var window = _____WB$wombat$assign$function_____("window");
var self = _____WB$wombat$assign$function_____("self");
var document = _____WB$wombat$assign$function_____("document");
var location = _____WB$wombat$assign$function_____("location");
var top = _____WB$wombat$assign$function_____("top");
var parent = _____WB$wombat$assign$function_____("parent");
var frames = _____WB$wombat$assign$function_____("frames");
var opener = _____WB$wombat$assign$function_____("opener");
import{initializeTimeMachine,}from "./modules/demonlist.js";import{get}from "../../core/js/modules/form.js";$(document).ready(function(){if(window.demon_id){initializePositionChart();initializeHistoryTable();}
initializeTimeMachine();});function initializeHistoryTable(){get("/api/v2/demons/"+window.demon_id+"/audit/movement/").then(response=>{let data=response.data;let tableBody=document.getElementById("history-table-body");let lastPosition=null;for(const entry of data){let newRow=document.createElement("tr");let cells=[1,2,3,4].map(()=>document.createElement("td"));if(entry["new_position"]>window.extended_list_length&&lastPosition>window.extended_list_length){continue;}
cells[0].innerText=entry["time"].split("T")[0];let positionChange=entry["new_position"]-lastPosition;if(lastPosition!==null){let arrow=document.createElement("i");if(positionChange<0){arrow.classList.add("fas","fa-arrow-up");newRow.classList.add("moved-up");}else{arrow.classList.add("fas","fa-arrow-down");newRow.classList.add("moved-down");}
if(entry["new_position"]>window.extended_list_length||lastPosition>window.extended_list_length){cells[1].appendChild(document.createTextNode("Legacy"));}else{cells[1].appendChild(arrow);cells[1].appendChild(document.createTextNode(" "+Math.abs(positionChange)));}}else{cells[1].innerText="-";}
if(entry["new_position"]!==undefined){if(entry["new_position"]>window.extended_list_length)
cells[2].innerText="-";else
cells[2].innerText=entry["new_position"];}
let reason=null;if(entry["reason"]==="Added"){reason="Added to list";}else if(entry["reason"]==="Moved"){reason="Moved";}else{if(entry["reason"]["OtherAddedAbove"]!==undefined){let other=entry["reason"]["OtherAddedAbove"]["other"];let name=other.name===null?"A demon":other["name"];reason=name+" was added above";}else if(entry["reason"]["OtherMoved"]!==undefined){let other=entry["reason"]["OtherMoved"]["other"];let verb=positionChange<0?"down":"up";let name=other.name===null?"A demon":other["name"];reason=name+" was moved "+verb+" past this demon"}}
cells[3].innerText=reason;lastPosition=entry["new_position"];cells.forEach(cell=>newRow.appendChild(cell));tableBody.appendChild(newRow);}});}
function initializePositionChart(){if(window.positionChartData){let highestPosition=Math.max(...window.positionChartData);let lowestPosition=Math.min(...window.positionChartData);let ticks=[-lowestPosition,-highestPosition];let span=highestPosition-lowestPosition;for(let historyPosition of window.positionChartData){let shouldAdd=true;for(let tick of ticks){if(Math.abs(historyPosition+tick)<=span/10)shouldAdd=false;}
if(shouldAdd)ticks.push(-historyPosition);}
let chart=new Chartist.Line("#position-chart",{labels:window.positionChartLabels,series:[window.positionChartData],},{lineSmooth:Chartist.Interpolation.step({postpone:false}),axisX:{stretch:true,ticks:window.positionChartLabels,labelOffset:{x:-20,},type:Chartist.StepAxis,},axisY:{high:-lowestPosition,low:-highestPosition,ticks:ticks,type:Chartist.FixedScaleAxis,labelInterpolationFnc:function(value){return-value;},},});chart.on("data",function(context){context.data.series=context.data.series.map(function(series){return series.map(function(value){return-value;});});});let observer=new MutationObserver(()=>chart.update());observer.observe(document.getElementById("position-chart").parentNode,{attributes:true,});}}
/*
     FILE ARCHIVED ON 00:13:17 Jun 13, 2024 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 03:06:08 Nov 08, 2026.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 0.689
  exclusion.robots: 0.07
  exclusion.robots.policy: 0.054
  esindex: 0.009
  cdx.remote: 145.752
  LoadShardBlock: 71.608 (3)
  PetaboxLoader3.datanode: 2348.694 (5)
  PetaboxLoader3.resolve: 111.407 (3)
  load_resource: 2675.569 (2)
  revisit.resolve: 519.15
*/