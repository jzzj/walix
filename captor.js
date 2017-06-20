var events = [];
var eventTypeList = ["input", "scroll", "click", "beforeunload"];
var noop = function(){};
var status = "ready";

var eventCaptor = {
  start: start,

  end: function(){
    const newWin = window.open("about:blank", "_blank");
    var info = "请保存以下事件信息：<br/><br/>"+JSON.stringify(events);
    if(newWin){
      //newWin.onload=function(){
      newWin.document.write(info);
      //}
    }else{
      document.write(JSON.stringify(events));
    }
    eventTypeList.forEach(function(eventType){
      if(eventType === "scroll"){
        window.removeEventListener(eventType, gEventHanlder, true);
      }else{
        document.body.removeEventListener(eventType, gEventHanlder, true);
      }
    });
    eventCaptor.start = start;
    events.length = 1;
    status = "ready";
  },

  replay: function(eventsStream){
    status = "replay";
    eventsStream = eventsStream || events.slice(0);
    function play(){
      var current = eventsStream.shift();
      var eventType = current.type;
      if(eventType === 'load'){
        return next();
      }
      var elem;
      if(current.xpath === ".//"){
        elem = document;
      }else{
        elem = document.evaluate(current.xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE).snapshotItem(0);
      }
      
      if(!elem){
        throw new Error("Match failure! Please make sure you are in the same page as you captured before, and check if the document had changed or create an issue!");
      }
      switch(eventType){
        case "input":
          elem.select();
          elem.value = current.value;
          //dispatchEvent(elem, eventType);
          break;
        case "click":
          elem.click();
          break;
        case "scroll":
          if(elem === document){
            window.scrollTo(0, current.y);
          }else{
            elem.scrollTop = current.y;
          }
          break;
        default:
          break;
      }
      next();
      function next(){
        if(eventsStream.length){
          setTimeout(play, current.interval);
        }
      }

      function dispatchEvent(element, eventType){
        if ("createEvent" in document) {
          var evt = document.createEvent("HTMLEvents");
          evt.initEvent(eventType, true, true);
          element.dispatchEvent(evt);
        }else{
          element.fireEvent("on"+eventType);
        }
      }
    }
    play();
  },

  stop: function(){
    status = "stop";
    unbindUnload();
    eventTypeList.forEach(function(eventType){
      if(eventType === "scroll"){
        window.removeEventListener(eventType, gEventHanlder, true);
      }else{
        document.body.removeEventListener(eventType, gEventHanlder, true);
      }
    });
    eventCaptor.start = start;
  },

  clear: function(){
    events.length = 1;
    unbindUnload();
    localStorage.removeItem('_walix_temp_save');
  },

  getEvents: function(){
    return events.slice(0);
  },

  getStatus: function(){
    return status;
  }
}

function start(){
  status = "start";
  //var originOnload = window.onload;
  //window.onload = function(){
    events.push({
      timestamp: +new Date(),
      type: 'load'
    });
    bindHandler();
    // originOnload && originOnload();
  //}
  // Make sure will not start more than once!
  localStorage.removeItem('_walix_temp_save');
  eventCaptor.start = noop;
}

var gEventHanlder;

function bindUnload(){
  var originBeforeunload = window.onbeforeunload;
  window.onbeforeunload = function(){
    window.localStorage.setItem("_walix_temp_save", JSON.stringify(events));
    if(originBeforeunload){
      return originBeforeunload();
    }
  }
  window._originBeforeunload;
}

function unbindUnload(){
  window.onbeforeunload = window._originBeforeunload;
}

function bindHandler(){
  bindUnload();
  eventTypeList.forEach(function(eventType){
    gEventHanlder = eventHanlder;
    if(eventType === "scroll"){
      window.addEventListener(eventType, gEventHanlder, true);
    }else{
      document.body.addEventListener(eventType, gEventHanlder, true);
    }
    function eventHanlder(e){
      if(status === "stop"){
        return;
      }
      if(eventType === 'input'){
        
      }else if(eventType === 'scroll'){
        if(e.target === document){
          e.clientY = window.scrollY;
        }else{
          e.clientY = e.target.scrollTop;
        }
      }
      var now = +new Date();
      var previousEvent = events[events.length - 1];
      var lasttime = previousEvent.timestamp;
      var interval = now - lasttime;
      var info = {
        timestamp: now,
        x: e.clientX,
        y: e.clientY,
        value: e.target && e.target.value || "",
        type: eventType,
        xpath: ".//" + getXPath(e.target)
      };
      // repeat event in chrome extension
      if(interval === 0){
        events[events.length - 1] = info;
        return;
      }
      console.info("[WALIX] TYPE:", info.type, ",TIMESTAMP:", new Date(info.timestamp).toLocaleString(), ",XPATH:", info.xpath, ",USAGE: document.evaluate('"+info.xpath+"', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE).snapshotItem(0);");
      previousEvent.interval = interval;  // set interval from previous action util current action
      
      events.push(info);
    }
  });
}

function getXPath(elem){
  if(elem === document){
    return "";
  }
  var rawTagName = elem.tagName;
  var tagName = rawTagName.toLowerCase();
  if(elem.id){
    return tagName + '[@id="' + elem.id + '"]';
  }else{
    var parentNode = elem.parentNode;
    if(parentNode && parentNode.tagName !== "HTML" && parentNode.tagName !== "DOCUMENT"){
      var children = parentNode.children;
      var len = children.length;
      var idx = 0;
      if(len !== 1){
        for(var i=0, cur; i<len; i++){
          cur = children[i];
          if(cur.tagName === rawTagName){
            idx++;
            if(elem === cur){
              break;
            }
          }
        }
      }
      return ((parentNode !== document) ? getXPath(parentNode) : "") + "/" + tagName + (idx===0 ? "" : "["+ idx +"]");
    }else{
      return tagName;
    }
  }
}

if(typeof window!=='undefined'){
  window.eventCaptor = eventCaptor;
  //eventCaptor.start();
}