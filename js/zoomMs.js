
//
// Zoom MS-50G / 60B / 70CDR
//
// MIDI commands
//  These commands are inferred by irresponsible experiment and not garanteed.
//
//  ProgramChange : [0xc0,pp]
//     Select patch by MIDI Program Change pp=patch number (0-49)
//  IdentityRequest : [0xf0,0x7e,0x00,0x06,0x01,0xf7]
//     Identity Request (MIDI Universal System Exclusive). It return [0xf0,0x7e,0x00,0x06,0x02,0x52,0x58,0x00,0x00,0x00,0x33,0x2e,0x30,0x30,0xf7]
//  TunerMode : [0xb0,0x4a,mm]
//     Tuner Mode On/Off. MIDI Control Change CC#74. mm<64:off mm>=64:on
//  WritePatch :          [0xf0,0x52,0x00,0x58,0x28,effect1,effect2,...effect6,patch-name,0xf7] (146bytes)
//     Write 146bytes patch-data to current program.
//     It consist of [0xf8,0x52,0x00,0x58,0x28, effect1,effect2,...effect6, patch-name,0xf7]
//  RequestPatch :        [0xf0,0x52,0x00,0x58,0x29,0xf7]
//     Requst patch-data of current program. it returns 146 bytes patch-data (same as WritePatch command)
//  EffectEnable :        [0xf0,0x52,0x00,0x58,0x31,nn,0x00,mm,0x00,0xf7]
//     Effect On/Off. It seems effective only for effect1-3.  nn=effect#(0-2) mm=0:off mm=1:on
//  ParameterEdit :       [0xf0,0x52,0x00,0x58,0x31,nn,pp,vvLSB,vvMSB,0xf7]
//     Parameter value edit. nn=effect# pp=param#+2 vv=value. value range is depends on each effect.
//  Patch Store :      [0xf0,0x52,0x00,0x58,0x32,0x01,0x00,0x00,pp,0x00,0x00,0x00,0x00,0x00,0xf7]
//     Message (Storing...)
//  RequestCurrentProgram : [0xf0,0x52,0x00,0x58,0x33,0xf7]
//     Request current bank&program. It returns [0xb0,0x00,0x00, 0xb0,0x20,0x00, 0xc0,pp] pp=program#(0-49) bank is always 0
//  ParameterEditEnable : [0xf0,0x52,0x00,0x58,0x50,0xf7]
//     Parameter value edit enable. Needed before Parameter Edit.
//  ParameterEditDisable :[0xf0,0x52,0x00,0x58,0x51,0xf7]
//     Parameter value edit disable.
//  ??? :                 [0xf0,0x52,0x00,0x58,0x60,0xf7]
//

var midiif=null;
var midioutputs=[];
var midiin=null;
var midirecv="";
var patches=[];
var clipboard=new apatch();
var inst=null;
var currentpatch=-1;
var currenteffect=0;
var currentparam=0;
var timer,timerprg;
var dragtarget=null;
var ready=false;
var instanceid=null;
var abort=false;
var url;
var autosave=0;

var patchkeymap=[
  "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t",
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T",
  "1","2","3","4","5","6","7","8","9","0"];
var effectkeymap=["F1","F2","F3","F4","F5","F6"];
var tunerkey="F9";
var dirty=0;

var emptypatch=[
  0xf0,0x52,0x00,0x58,0x28,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x40,0x05,0x0f,0x45,0x00,0x6d,0x70,0x74,0x79,0x20,0x20,
  0x20,0x00,0x20,0x20,0x00,0xf7
];

var bampcab=[
  { //ver 1.00
    max:[16,32,48,96,112,192,0],
    disp:["AG 8x10","BM 4x12","HA 4x10","AC 1x18","AL 4x10","MB 1x12","OFF"],
  },
  { //ver 2.00
    max:[16,32,48,96,112,192,64,80,128,144,160,176,0],
    disp:["AG 8x10","BM 4x12","HA 4x10","AC 1x18","AL 4x10","MB 1x12","SWR 4x10","AG 1x15","PT 1x15","SB 4x12","GK 4x10","E 4x10","OFF"],
  },
];
var gampcab=[
  { //ver 1.00
    max:[8,16,48,80,144,240,304,320,0],
    disp:["FD COMBO 2x12","DLX-R 1x12","US BLUES 4x10","VX JMI 2x12","TW ROCK 1x12","MS 1959 4x12","DZ DRIVE 4x12","ALIEN 4x12","OFF"],
  },
  { //ver 3.00
    max:[8,16,32,48,64,80,96,112,128,144,160,176,192,208,224,240,256,272,288,304,320,336,0],
    disp:["FD COMBO 2x12","DLX-R 1x12","FD VIBRO 2x10","US BLUES 4x10","VX COMBO 2x12","VX JMI 2x12","BG CRUNCH 1x12","MATCH 30 2x12","CAR DRIVE 1x12","TW ROCK 1x12","TONE CITY 4x12","HW STACK 4x12","TANGERINE 4x12","B-BRKR 2x12","MS CRUNCH 4x12","MS 1959 4x12","MS DRIVE 4x12","BGN DRIVE 4x12","BG DRIVE 4x12","DZ DRIVE 4x12","ALIEN 4x12","REVO-1 4x12","OFF"],
  }
];


function dumpeff(){
  console.log("name,group,ms50g,ms60b,ms70cdr,dsp(%),description")
  for(i in effectlist){
    var ef=effectlist[i];
    var v50=ef.ver&0xf;
    var v60=(ef.ver>>4)&0xf;
    var v70=(ef.ver>>8)&0xf;
    console.log("\""+ef.name+"\","+ef.group+","+((v50>0)?v50:"")+","+((v60>0)?v60:"")+","+((v70>0)?v70:"")+","+(100/ef.dsp).toFixed(1)+","+ef.title);
  }
}
function MidiIf(ma){
  this.midiaccess=ma;
  this.midiout=null;
  this.devid=0x58;
  this.version=3;
  this.devstr="50g";
  this.sysexhead="f0520058";
  this.que=[];
  this.scan=-1;
  this.dump=1;
  this.supress=0;
  this.waitdata=null;
  this.callback=null;
  this.ready=0;
  this.pcnt=0;
  this.workpatch=new apatch();
  this.midiinport=null;
  this.midiaccess.onstatechange=function(ev){
    console.log("StateChange",ev)
  };
  this.instSet=function(){
    for(var id in effectlist){
      var v=effectlist[id].ver;
      switch(this.devid){
      case 0x58: v=v&0xf; break;
      case 0x5f: v=(v>>4)&0xf; break;
      case 0x61: v=(v>>8)&0xf; break;
      }
      var el=document.getElementById("e_"+id);
      if(el){
        if(v==0||v>this.version){
          effectlist[id].install=-2;
          document.getElementById("e_"+id).classList.add("notinstall");
        }
        else if(this.devid!=0x58){
          effectlist[id].install=1;
          document.getElementById("e_"+id).classList.add("install");
        }
      }
    }
  }
  this.recv=function(ev){
    if(abort)
      return;
    midirecv=MakeStr(ev.data);
    switch(this.dump){
    case 1:
      if(ev.data[0]>=0xf0)
        console.log(midirecv);
      break;
    case 2:
      console.log(midirecv);
      break;
    }
    if((!this.supress ||this.waitdata=="c0") && ev.data[0]==0xc0){
      if(currentpatch!=ev.data[1] && this.scan<0){
        SetPatchFocus(0);
        currentpatch=ev.data[1];
        DispPatch();
        SetPatchFocus(1);
      }
    }
    if(midirecv.indexOf(this.sysexhead+"31")==0){
      if(ev.data[6]==0)
        SetEffectState(currentpatch,ev.data[5],0);
      if(ev.data[6]>=2){
        var v=(ev.data[7]&0x7f)+((ev.data[8]&0x7f)<<7);
        SetParamVal(currentpatch,ev.data[5],ev.data[6],v);
        if(this.dump==3){
          console.log(ev.data[5],ev.data[6],v);
        }
        DispPatch();
      }
    }
    else if(midirecv.indexOf("f07e00060252")==0){
      var v=String.fromCharCode(ev.data[10],ev.data[11],ev.data[12],ev.data[13]);
      this.version=parseFloat(v);
      switch(this.devid=ev.data[6]){
      case 0x58:
        this.sysexhead="f0520058";
        this.devstr="50g";
        this.instSet();
        document.getElementById("device").innerHTML="MS-50G";
        document.getElementById("effects").rows[4].style.display="";
        document.getElementById("effects").rows[5].style.display="";
        for(var id in effectlist){
          var ef=effectlist[id];
          if(ef.group=="AMP" && (ef.ver&0xf)){
            ef.param[7].max=gampcab[(v>=3)?1:0].max;
            ef.param[7].disp=gampcab[(v>=3)?1:0].disp;
          }
        }
        break;
      case 0x5f:
        this.sysexhead="f052005f";
        this.devstr="60b";
        this.instSet();
        document.getElementById("device").innerHTML="MS-60B";
        document.getElementById("effects").rows[4].style.display="none";
        document.getElementById("effects").rows[5].style.display="none";
        for(var id in effectlist){
          var ef=effectlist[id];
          if(ef.group=="AMP" && (ef.ver&0xf0)){
            ef.param[7].max=bampcab[(v>=2)?1:0].max;
            ef.param[7].disp=bampcab[(v>=2)?1:0].disp;
          }
        }
        break;
      case 0x61:
        this.sysexhead="f0520061";
        this.devstr="70cdr";
        this.instSet();
        document.getElementById("device").innerHTML="MS-70CDR";
        document.getElementById("effects").rows[4].style.display="";
        document.getElementById("effects").rows[5].style.display="";
        break;
      }
      inst.ShowAll(false);
      document.getElementById("firmver").innerHTML=v;
    }
    else if(midirecv.indexOf(this.sysexhead+"28")==0){
      var name=MakeName(ev.data);
      if(this.scan>=0){
        document.getElementById("waitmsg").innerHTML="Scanning Patches...("+this.scan+"/50)";
        patches[this.scan].ReadBin(ev.data);
        DispPatchName(this.scan);
        for(var ii=0;ii<6;++ii){
          var id=patches[this.scan].GetEffectId(ii);
          if(id && effectlist[id]){
            effectlist[id].install=1;
            var el=document.getElementById("e_"+id);
            if(el) el.classList.add("install");
          }
        }
        ++this.scan;
        if(this.scan>49){
          this.scan=-1;
          this.ready=1;
          midiif.Send([0xc0,currentpatch]);
          SetPatchFocus(1);
          DispPatch();
          document.getElementById("waitbase").style.display="none";
          ready=true;
          for(i=0;i<6;++i){
            var cell=document.getElementById("fnam"+(i+1));
            var cell2=document.getElementById("fnum"+(i+1));
            cell.oncontextmenu=function(ev){
              currenteffect=parseInt(ev.target.id[4])-1;
              SetCurrentEffect(currenteffect);
              midiif.SendCurrentPatch();
              PopupEffectMenu(ev.target);
              ev.preventDefault();
            };
            cell.ondblclick=function(ev){
              document.getElementById("effectpanelmsg").innerHTML="Add / Replace Effect";
              document.getElementById("effectpanelbase").style.display="block";
            };
            cell.onclick=function(ev){
              currenteffect=parseInt(ev.target.id[4])-1;
              SetCurrentEffect(currenteffect);
              ToggleEffect(currenteffect);
              UpdateFocus();
              DispPatchName(currentpatch);
              ev.preventDefault();
            };
            cell2.onclick=cell2.oncontextmenu=function(ev){
              currenteffect=parseInt(ev.target.id[4])-1;
              PopupEffectMenu(ev.target);
              SetCurrentEffect(currenteffect);
              midiif.SendCurrentPatch();
              ev.stopPropagation();
              ev.preventDefault();
            };
          }
        }
        else{
          this.que.push([0xc0,this.scan]);
          this.que.push([0xf0,0x52,0,this.devid,0x29,0xf7]);
        }
      }
      else{
        patches[currentpatch].ReadBin(ev.data);
        for(var ii=0;ii<6;++ii){
          var id=patches[currentpatch].GetEffectId(ii);
          if(id && effectlist[id]){
            effectlist[id].install=1;
            var el=document.getElementById("e_"+id);
            if(el) el.classList.add("install");
          }
        }
        DispPatch();
        DispPatchName(currentpatch);
      }
    }
    if(this.waitdata){
      if(midirecv.indexOf(this.waitdata)==0){
        this.supress=0;
        this.waitdata=null;
        if(this.callback){
          this.callback(ev.data,midirecv);
        }
      }
    }
  };
  this.StartScan=function(){
    console.log("StartScan")
    if(!this.midiout)
      return;
    document.getElementById("waitmsg").innerHTML="";
    document.getElementById("waitbase").style.display="block";
    this.SendDirect([0xf0,0x7e,0x00,0x06,0x01,0xf7]);
    setTimeout(function(){
      this.SendDirect([0xf0,0x52,0x00,this.devid,0x50,0xf7]);
      this.scan=0;
      setTimeout(function(){
        this.SendWait([0xf0,0x52,0x00,this.devid,0x33,0xf7],"c0",function(dat){
          this.norg=currentpatch=dat[1];
          this.que.push([0xf0,0x52,0x00,this.devid,0x50,0xf7]);
          this.que.push([0xc0,this.scan]);
          this.que.push([0xf0,0x52,0,this.devid,0x29,0xf7]);
        }.bind(this));
      }.bind(this),100);
    }.bind(this),200);
  };
  this.SendDirect=function(d){
    if(this.dump==4)
      console.log("S:"+MakeStr(d));
    if(this.midiout)
      this.midiout.send(d);
  };
  this.Send=function(d){
    if(this.que.length>2){
      var d2=this.que[this.que.length-1];
      if(d[0]==0xf0 && d2[0]==0xf0){
        if(d[4]==0x28 && d2[4]==0x28){
          this.que.pop();
        }
        else if(d[4]==0x31 && d2[4]==0x31 && d[5]==d2[5] && d[6]==d2[6]){
          this.que.pop();
        }
      }
    }
    this.que.push(d);
  };
  this.RequestPatch=function(){
    this.Send([0xf0,0x52,0x00,this.devid,0x29,0xf7]);
//    this.SendWait([0xf0,0x52,0x00,this.devid,0x29,0xf7],this.sysexhead+"28",null);
  };
  this.SendParamChange=function(f,p,v){
    var cmd=[0xf0,0x52,0x00,this.devid,0x31,f,p,v&0x7f,(v>>7)&0x7f,0xf7];
    this.Send(cmd);
  };
  this.SendCurrentPatch=function(){
    this.Send(patches[currentpatch].MakeBin(this.devid));
  };
  this.SendCurrentPatchVerify=function(callback){
    var o=[];
    var len=(midiif.devid==0x5f)?4:6;
    for(var i=0;i<len;++i){
      o.push(patches[currentpatch].GetEffectId(i));
    }
    this.SendCurrentPatch();
    setTimeout(function(){
      this.SendWait([0xf0,0x52,0x00,this.devid,0x29,0xf7],this.sysexhead+"28",function(dat,str){
        var s="";
        this.workpatch.ReadBin(dat);
        for(var j=0;j<len;++j){
          if(o[j]!=patches[currentpatch].GetEffectId(j)){
            var el=document.getElementById("e_"+o[j]);
            if(el){
              el.classList.add("notinstall");
              if(effectlist[o[j]].install==0)
                effectlist[o[j]].install=-1;
              s+="["+effectlist[o[j]].name+"]";
            }
          }
        }
        if(callback)
          callback(s.length?s:null);
      })
    }.bind(this),200);
  };
  this.SendWait=function(sd,rv,cb){
    this.supress=1;
    this.callback=cb;
    this.waitdata=rv;
    this.SendDirect(sd);
  };
  this.timer=function(){
    if(abort)
      return;
    var id=0;
    var cookies=document.cookie.split(";");
    for(var i=0;i<cookies.length;++i){
      if(cookies[i].indexOf("patcheditor=")==0){
        id=parseInt(cookies[i].split("=")[1]);
      }
    }
    if(id!=0&&id!=instanceid){
      AlertMsg("Another Patch Editor is launched.<br/> This instance is no more effective. <br/>Reload?",function(){
        window.location.href=url;
      });
      abort=true;
      return;
    }
    if(!this.midiout)
      return;
    if(this.supress)
      return;
    if(this.waitdata)
      return;
    if(this.scan>=0){
      if(this.que.length>0){
        var d=this.que.shift();
        this.SendDirect(d);
      }
      return;
    }
    else if(this.que.length>0){
      var d=this.que.shift();
      this.SendDirect(d);
    }
    else{
      if(this.ready){
        if(dirty>0){
          if(++dirty>40){
            dirty=0;
            if(autosave)
              StorePatch(currentpatch);
          }
        }
        this.SendWait([0xf0,0x52,0x00,this.devid,0x33,0xf7],"c0");
      }
    }
  };
  this.PortScan=function(){
    midioutputs=[];
    document.getElementById("midiport").innerHTML="";
    var i=0;
    var outputIterator=this.midiaccess.outputs.values();
    for(var o=outputIterator.next(); !o.done; o=outputIterator.next()) {
        midioutputs[i]=o.value;
        var op=new Option(o.value.name);
        if(o.value.name.startsWith("ZOOM MS Series"))
          op.selected=true;
        else
          op.disabled=true;
        document.getElementById("midiport").options[i]=op;
        i++;
    }
    var inputIterator=this.midiaccess.inputs.values();
    for(var ip=inputIterator.next(); !ip.done; ip=inputIterator.next()){
      if(ip.value.name.startsWith("ZOOM MS Series") && this.midiinport==null){
        this.midiinport=ip.value;
        this.recvhander=this.recv.bind(this);
        this.midiinport.onmidimessage=this.recvhander;
      }
    }
  };
  this.SelectPort=function(){
    var idx=document.getElementById("midiport").selectedIndex;
    if(idx>=0 && midioutputs.length>0){
      this.midiout=midioutputs[idx];
      if (!this.midiout.name.startsWith("ZOOM MS Series"))
        this.midiout=null;
    }
  };
  this.PortScan();
  this.SelectPort();
  if(!this.midiout)
    AlertMsg("<br/>MIDI port is not found.<br/>Retry after connect ZOOM MS device.");
  this.timerid=setInterval(this.timer.bind(this),80);
}

function MakeStr(b){
  var str="";
  for(var j=0;j<b.length;++j)
    str+=("00"+b[j].toString(16)).substr(-2);
  return str;
}
function MakeName(b){
  var name="";
  var len=b.length;
  for(var j=0;j<13;++j){
    var c=b[((len>=146)?132:91)+j];
    if(c)
      name+=String.fromCharCode(c);
  }
  return name;
}
function MakeBin(s,len){
  var bin=[];
  s=s.replace(/[\x00-\x20\x7f-\x9f]/g, '');
  for(var j=0;j<s.length&&j<len*2;j+=2)
    bin.push(parseInt(s.substr(j,2),16));
  return bin;
}
function Init(){
  var i;
  if(typeof(nw)!="undefined"){
    var nwgui= require("nw.gui");
    nwgui.Window.get().on('new-win-policy', function(frame, url, policy) {
      policy.ignore();
      nwgui.Shell.openExternal(url);
    });
  }
  document.getElementById("g200kglogo").addEventListener("click",()=>{OpenUrl("https://www.g200kg.com")});
  document.getElementById("github").addEventListener("click",()=>{OpenUrl("https://github.com/g200kg/zoom-ms-utility")});
  document.getElementById("github2").addEventListener("click",()=>{OpenUrl("https://github.com/g200kg/zoom-ms-utility")});
  if(!navigator.requestMIDIAccess){
    AlertMsg("This browser does not support Web MIDI API. Please use latest Chrome.");
    return;
  }
  url=location.href;
  instanceid=""+(Math.random()*1000000)|0;
  document.cookie="patcheditor="+instanceid;
  document.cookie="max-age=604800";
  var cookies=document.cookie.split(";");
  for(i=0;i<cookies.length;++i){
    if(cookies[i].indexOf("autosave=")==0){
      var as=parseInt(cookies[i].split("=")[1]);
      if(as==0)
        AutoSave();
    }
  }
  navigator.requestMIDIAccess({sysex:true}).then(
      function(ma){midiif=new MidiIf(ma);},
      function(e){
        AlertMsg("requestMIDIAccess Error.<br/><br/><img src='./images/mididisableicon.png' align='left' style='margin:5px'/>"
        + "If an icon of keyboard with 'x' mark is displayed at the right end of the address bar, "
        + "click the icon, clear setting, reload and allow 'use MIDI device'."
        );
      },
    );
  for(i=0;i<50;++i)
    patches[i]=new apatch();
  AutoSave();
  for(i=0;i<6;++i){
    var ef=document.getElementById("fnam"+(i+1));
    var im=document.getElementById("fimg"+(i+1));
    ef.draggable=true;
    im.draggable=false;
    ef.ondragstart=function(ev){
      ev.dataTransfer.setData("text",ev.target.id);
      this.classList.add("drag");
      currenteffect=parseInt(this.id[4])-1;
      for(var j=0;j<6;++j){
        var ef=document.getElementById("fnam"+(j+1));
        ef.ondragend=function(ev){
          this.classList.remove("drag");
          for(var jj=0;jj<6;++jj){
            var dst=document.getElementById("fnam"+(jj+1));
            dst.ondragenter=dst.ondragleave=dst.ondragover=dst.ondrop=null;
          }
        };
        ef.ondragenter=function(ev){
          var d=parseInt(ev.target.id[4])-1;
          if(d>currenteffect)
            this.classList.toggle("overdown");
          else if(d<currenteffect){
            this.classList.toggle("overup");
          }
        };
        ef.ondragleave=function(ev){
          var d=parseInt(ev.target.id[4])-1;
          if(d>currenteffect)
            this.classList.toggle("overdown");
          else if(d<currenteffect)
            this.classList.toggle("overup");
        };
        ef.ondragover=function(ev){
          ev.preventDefault();
        };
        ef.ondrop=function(ev){
          this.classList.remove("overup");
          this.classList.remove("overdown");
          var s=parseInt(event.dataTransfer.getData("text")[4])-1;
          var d=parseInt(ev.target.id[4])-1;
          if(s!=d){
            if(s>d){
              var e=GetEffect(currentpatch,s);
              for(var i=s;i>d;--i)
                SetEffect(currentpatch,i,GetEffect(currentpatch,i-1));
              SetEffect(currentpatch,d,e);
              SetCurrentEffect(d);
              DispPatchName(currentpatch);
              midiif.SendCurrentPatch();
              dirty=1;
            }
            else{
              var e=GetEffect(currentpatch,s);
              for(var i=s;i<d;++i)
                SetEffect(currentpatch,i,GetEffect(currentpatch,i+1));
              SetEffect(currentpatch,d,e);
              SetCurrentEffect(d);
              DispPatchName(currentpatch);
              midiif.SendCurrentPatch();
              dirty=1;
            }
          }
          ev.preventDefault();
        };
      }
    };
    var tab=document.getElementById("effects");
    for(var j=0;j<9;++j){
      var p=tab.rows[i].cells[j+2].childNodes[0];
      var c="f"+(i+1)+"p"+(j+1);
      var k=document.getElementById(c+"k");
      var s=document.getElementById(c+"s");
      var v=document.getElementById(c+"v");
      p.onclick=p.oncontextmenu=function(ev){
        var id=ev.target.id;
        if(id[0]!="f")
          id=ev.target.parentNode.parentNode.id;
        currenteffect=parseInt(id[1])-1;
        currentparam=parseInt(id[3])-1;
        SetCurrentEffect(currenteffect);
        midiif.Send(patches[currentpatch].MakeBin(midiif.devid));
        UpdateFocus();
        ev.preventDefault();
      };
      k.valuetip=0;
      k.oninput = function(k){
        var f=parseInt(k.target.id[1]);
        var p=parseInt(k.target.id[3]);
        SetCurrentEffect(f-1);
        if(k.target.tab){
          var v=k.target.tab[k.target.value|0];
          SetParamVal(currentpatch,f-1,p+1,v);
        }
        else
          SetParamVal(currentpatch,f-1,p+1,k.target.value);
        DispPatch();

        if(f<=3 && f-1==currenteffect){
          midiif.SendParamChange(f-1,p+1,patches[currentpatch].GetParamVal(f-1,p+1));
        }
        else{
          midiif.SendCurrentPatch();
          currenteffect=f-1;
          dirty=1;
        }
      };
      if(s){
        s.onchange=function(s){
          var f=parseInt(s.target.id[1]);
          var p=parseInt(s.target.id[3]);
          SetCurrentEffect(f-1);
          SetParamVal(currentpatch,f-1,p+1,s.target.value);
          DispPatch();
          midiif.SendCurrentPatch();
          dirty=1;
        }
      }

      v.ondblclick=function(ev){
        var f=parseInt(ev.target.id[1]);
        var p=parseInt(ev.target.id[3]);
        var id=patches[currentpatch].GetEffectId(f-1);
        var ef=effectlist[id];
        var par=ef.param[p-1];
        PopupEdit(f,p,par);
      }

    }
  }
  for(i=0;i<50;++i){
    for(var ii=0;ii<6;++ii){
      var id=patches[i].GetEffectId(ii);
      if(id){
        effectlist[id].install=1;
        document.getElementById("e_"+id).classList.add("install");
      }
    }
    var cell=document.getElementById((i+1)+"nam");
    for(var f=0;f<6;++f){
      var c=document.createElement("div");
      c.setAttribute("style","right:"+(f*5)+"px");
      c.id=(i+1)+"_"+(f+1);
      c.setAttribute("class","eficon");
      cell.parentNode.appendChild(c);
    }
    var btn=document.getElementById((i+1)+"btn");
      cell.oncontextmenu=function(ev){
      PopupPatchMenu2(ev.target);
      ev.preventDefault();
    };
    cell.onclick=function(ev){
      document.getElementById("popuppatch").style.display="none";
      SelectPatch(parseInt(ev.target.id)-1);
    };
    cell.onmousedown=function(ev){
      document.getElementById("popuppatch").style.display="none";
      SelectPatch(parseInt(ev.target.id)-1);
    };
    btn.onmousedown=function(ev){
      document.getElementById("popuppatch").style.display="none";
      SelectPatch(parseInt(ev.target.id)-1);
    }
    btn.onclick=btn.oncontextmenu=function(ev){
      SelectPatch(parseInt(ev.target.id)-1);
      PopupPatchMenu2(ev.target);
      ev.stopPropagation();
      ev.preventDefault();
    };
    cell.draggable=true;
    cell.ondragstart=function(ev){
      ev.dataTransfer.setData("text",ev.target.id);
      this.classList.add("drag");
      for(var j=0;j<50;++j){
        var c=document.getElementById((j+1)+"nam");
        c.ondragenter=function(ev){this.classList.add("over");};
        c.ondragleave=function(ev){this.classList.remove("over");};
        c.ondragover=function(ev){ev.preventDefault();};
        c.ondrop=function(ev){
          this.classList.remove("over");
          var s=parseInt(event.dataTransfer.getData("text"));
          var d=parseInt(ev.target.id);
          if(s!=d){
            PopupPatchMenu(ev.target);
            dragtarget=ev.target;
          }
          ev.preventDefault();
        };
        c.ondragend=function(ev){
          this.classList.remove("over");
          this.classList.remove("drag");
          for(var jj=0;jj<50;++jj){
            cc=document.getElementById((jj+1)+"nam");
            cc.ondragenter=cc.ondragleave=cc.ondragover=cc.ondrop=cc.ondragend=null;
          }
        };
      }
    };
  }
  var p=document.getElementById("efpanel0");
  for(var id in effectlist){
    var ef=effectlist[id];
    var e=document.createElement("div");
    var im1="./images/50v"+(ef.ver&0xf)+".png";
    var im2="./images/60v"+((ef.ver>>4)&0xf)+".png";
    var im3="./images/70v"+((ef.ver>>8)&0xf)+".png";
    e.innerHTML="<div class='dspbar'></div><img src='./images/"+ef.name.replace(/ /g,"_")+".png' draggable='false'/><div>"+ef.name+"</div><img class='mk50' src='"+im1+"'/><img class='mk60' src='"+im2+"'/><img class='mk70' src='"+im3+"'/>";
    e.setAttribute("class","efitem");
    e.setAttribute("title",ef.title);
    var b=e.childNodes[0];
//    var d=(ef.dspmax+ef.dspmin)*.5;
    var d=1/ef.dsp;
    b.style.height=d*40+"px";
    var r=(d>=0.33?255:d*3*255)|0;
    var g=(d>=0.5?0:(d>=0.33?255-(d-0.33)*5.9*255:255))|0;
    b.style.background=ef.col="rgb("+r+","+g+",0)";
    b.style.borderTop=((40-d*40)|0)+"px solid #000";
    var div=document.getElementById("ef"+ef.group);
    if(div){
      div.appendChild(e);
      e.id="e_"+id;
      e.onclick=function(ev){
        if(document.getElementById("effectpanelmsg").innerHTML!="Install Check"){
          var id=ev.target.id;
          if(!id)
            id=ev.target.parentNode.id;
          id=parseInt(id.substring(2));
          var ef=GetEffectFromId(id);
          SetEffect(currentpatch,currenteffect,ef);
          SetCurrentEffect(currenteffect);
          EffectPanelCancel();
          if(effectlist[id].install==0){
            effectlist[id].install=-1;
            document.getElementById("e_"+id).classList.add("notinstall");
          }
          midiif.SendCurrentPatch();
          midiif.RequestPatch();
          dirty=1;

//?
//          midiif.SendCurrentPatchVerify(null,function(s){
//            AlertMsg("Effect "+s+" is not installed.");
//          });
        }
      }
    }
  }
  ShowDoc(GetLang()=="ja"?"ja":"en");
  inst=new InstallChecker();
  document.addEventListener("click",function(ev){
    PopupEffectCancel();
    PopupPatchCancel();
    PopupPatchCancel2();
    document.getElementById("popupeditpanel").style.display="none";
  });
  document.addEventListener("keydown",function(ev){
    if(ready){
      var p;
      if(document.getElementById("inputbase").style.display=="block"
        || document.getElementById("confirmbase").style.display=="block"
        || document.getElementById("textareabase").style.display=="block"
        || document.getElementById("popupeditpanel").style.display=="block"
        ){
        if(ev.key=="Escape"){
          document.getElementById("inputbase").style.display="none";
          document.getElementById("confirmbase").style.display="none";
          document.getElementById("textareabase").style.display="none";
          document.getElementById("popupeditpanel").style.display="none";
        }
        return;
      }
      if(ev.ctrlKey||ev.altKey)
        return;
      if(ev.key=="ArrowUp"||ev.key=="ArrowDown"||ev.key=="PageUp"||ev.key=="PageDown"){
        if(currenteffect>=0&&currentparam>=0){
          var i="f"+(currenteffect+1)+"p"+(currentparam+1);
          var k=document.getElementById(i+"k");
          var s=document.getElementById(i+"s");
          if(k){
            var p1=Math.max((((k.max-k.min)*0.05)|0),1);
            var p2=Math.max((((k.max-k.min)*0.01)|0),1);
            var v=k.value;
            switch(ev.key){
            case "ArrowUp":
              if(ev.shiftKey)
                v=Math.min(v+=p1,k.max);
              else
                v=Math.min(v+=1,k.max);
              break;
            case "ArrowDown":
              if(ev.shiftKey)
                v=Math.max(v-=p1,k.min);
              else
                v=Math.max(v-=1,k.min);
              break;
            case "PageUp":
              v=Math.min(v+=p1,k.max);
              break;
            case "PageDown":
              v=Math.max(v-=p1,k.min);
              break;
            }
            if(k.setValue)
              k.setValue(v,true);
          }
        }
      }
      if(ev.key=="ArrowLeft" || ev.key=="ArrowRight"){
        p=currentpatch;
        if(ev.key=="ArrowLeft"){
          if(--p<0)
            p=49;
        }
        else{
          if(++p>=50)
            p=0;
        }
        SelectPatch(p);
        ev.preventDefault();
      }
      if(ev.key==tunerkey){
        document.getElementById("tunerbtn").click();
      }
      var p=patchkeymap.indexOf(ev.key);
      if(p>=0){
        SelectPatch(p);
        ev.preventDefault();
      }
      var e=effectkeymap.indexOf(ev.key);
      if(e>=0){
        SetCurrentEffect(e);
        ToggleEffect(e);
        ev.preventDefault();
      }
    }
  });
}
function Scan(){
  midiif.StartScan();
}
function StateChange(){
  console.log("StateChange");
}
function UpdateFocus(){
  var tab=document.getElementById("effects");
  for(f=0;f<6;++f){
    for(p=0;p<9;++p){
      var cell=tab.rows[f].cells[p+2].childNodes[0];
      if(f==currenteffect&&p==currentparam)
        cell.classList.add("pfocus");
      else
        cell.classList.remove("pfocus");
    }
  }
}
function AlertMsg(msg,callback){
  document.getElementById("alertmsg").innerHTML=msg;
  if(callback)
    document.getElementById("alertok").onclick=callback;
  else
    document.getElementById("alertok").onclick=function(){document.getElementById("alertbase").style.display="none"};
  document.getElementById("alertbase").style.display="block";
}
function Confirm(msg,callback,pos){
  document.getElementById("confirmmsg").innerHTML=msg;
  var st=document.getElementById("confirmpanel").style;
  if(pos){
    st.left=pos.x+"px",st.top=pos.y+"px";
    st.margin="0";
  }
  else{
    st.left=st.right=st.top=st.bottom="0";
    st.margin="auto";
  }
  document.getElementById("confirmok").onclick=callback;
  document.getElementById("confirmbase").style.display="block";
}
function PopupEffectMenu(tar){
  currenteffect=parseInt(tar.id[4])-1;
  UpdateFocus();
  var rc=tar.getBoundingClientRect();
  var e=document.getElementById("popupeffect");
  e.style.display="block";
  e.style.left=(rc.right+5+window.pageXOffset)+"px";
  e.style.top=(rc.top-20+window.pageYOffset)+"px";
}
function PopupEffectCancel(){
  document.getElementById("popupeffect").style.display="none";
}
function EffectPanelCancel(){
  document.getElementById("effectpanelbase").style.display="none";
}
function PopupEffectDelete(){
  var tar=document.getElementById("fnam"+(currenteffect+1));
  var rc=tar.getBoundingClientRect();
  var panel=document.getElementById("confirmpanel");
  Confirm("Delete Effect Unit ?",function(ev){
    var n=(midiif.devid==0x5f)?4:6;
    for(var j=currenteffect;j<n-1;++j){
      for(var i=0;i<11;++i){
        SetParamVal(currentpatch,j,i,GetParamVal(currentpatch,j+1,i));
      }
    }
    SetParamVal(currentpatch,n-1,0,1);
    for(var i=1;i<10;++i)
      SetParamVal(currentpatch,n-1,i,0);
    SetCurrentEffect(currenteffect);
    DispPatch();
    DispPatchName(currentpatch);
    midiif.SendCurrentPatch();
    midiif.RequestPatch();
    ev.target.parentNode.parentNode.style.display="none";
    dirty=1;
  },
  {x:(rc.left-20+window.pageXOffset),y:(rc.top+40+window.pageYOffset)});
}
function PopupEffectReplace(){
  document.getElementById("effectpanelmsg").innerHTML="Add / Replace Effect";
  document.getElementById("effectpanelbase").style.display="block";
}
function PopupEffectInsert(){
  var efmax=(midiif.devid==0x5f)?4:6;
  if(patches[currentpatch].fx[efmax-1][1]!=0)
    return;
  for(var j=efmax-1;j>currenteffect;--j){
    for(var k=0;k<11;++k){
      SetParamVal(currentpatch,j,k,GetParamVal(currentpatch,j-1,k));
    }
  }
  SetParamVal(currentpatch,currenteffect,0,1);
  for(var k=1;k<11;++k)
    SetParamVal(currentpatch,currenteffect,k,0);
  DispPatch();
  DispPatchName(currentpatch);
  SetCurrentEffect(currenteffect);
  midiif.SendCurrentPatch();
  dirty=1;
  PopupEffectCancel();
}
function PopupEffectUp(){
  if(currenteffect>0){
    var e=GetEffect(currentpatch,currenteffect);
    SetEffect(currentpatch,currenteffect,GetEffect(currentpatch,currenteffect-1));
    SetEffect(currentpatch,currenteffect-1,e);
    DispPatchName(currentpatch);
    midiif.SendCurrentPatch();
    dirty=1;
  }
  PopupEffectCancel();
}
function PopupEffectDown(){
  if(currenteffect<5){
    var e=GetEffect(currentpatch,currenteffect);
    SetEffect(currentpatch,currenteffect,GetEffect(currentpatch,currenteffect+1));
    SetEffect(currentpatch,currenteffect+1,e);
    DispPatchName(currentpatch);
    midiif.SendCurrentPatch();
    dirty=1;
  }
  PopupEffectCancel();
}
function PopupPatchMenu2(tar){
  var rc=tar.getBoundingClientRect();
  var e=document.getElementById("popuppatch2");
  e.style.display="block";
  e.style.left=(rc.left-20+window.pageXOffset)+"px";
  e.style.top=(rc.top+20+window.pageYOffset)+"px";
}
function PopupPatchCancel2(){
  document.getElementById("popuppatch2").style.display="none";
}
function PopupPatchMenu(tar){
  var rc=tar.getBoundingClientRect();
  var e=document.getElementById("popuppatch");
  e.style.display="block";
  e.style.left=(rc.left-20+window.pageXOffset)+"px";
  e.style.top=(rc.top+20+window.pageYOffset)+"px";
}
function PopupPatchCancel(){
  var e=document.getElementById("popuppatch");
  e.style.display="none";
  if(dragtarget){
    dragtarget=null;
  }
}
function PopupPatchOverwrite(){
  var t=(parseInt(dragtarget.id)-1);
  document.getElementById("popuppatch").style.display="none";
  clipboard.CopyFrom(patches[currentpatch]);
  SelectPatch(t);
  PopupPatchPaste(t);
  dragtarget=null;
}
function PopupPatchExchange(){
  var dst=parseInt(dragtarget.id)-1;
  clipboard.CopyFrom(patches[currentpatch]);
  patches[currentpatch].CopyFrom(patches[dst]);
  DispPatchName(currentpatch);
  SendPatch(currentpatch);
  PopupPatchPaste(dst);
  dragtarget=null;
  var e=document.getElementById("popuppatch");
  e.style.display="none";
}
function PopupPatchCopy(){
  clipboard.CopyFrom(patches[currentpatch]);
  PopupPatchCancel2();
}
function PopupPatchPaste(t){
  if(clipboard){
    if(typeof(t)=="undefined")
      t=currentpatch;
    patches[t].CopyFrom(clipboard);
    DispPatch();
    DispPatchName(t);
    if(t!=currentpatch)
      SelectPatch(t);
    midiif.Send(patches[currentpatch].MakeBin(midiif.devid));
    midiif.RequestPatch();
    if(autosave)
      StorePatch(t);
  }
  PopupPatchCancel2();
}
function PopupPatchDelete(){
  var tar=document.getElementById((currentpatch+1)+"nam");
  var rc=tar.getBoundingClientRect();
  var panel=document.getElementById("confirmpanel");
  Confirm("Delete patch ?",function(ev){
    for(var i=0;i<6;++i){
      for(var j=0;j<11;++j){
        patches[currentpatch].fx[i][j]=0;
      }
    }
    patches[currentpatch].maxfx=1;
    patches[currentpatch].curfx=0;
    patches[currentpatch].name="Empty";
    midiif.Send(patches[currentpatch].MakeBin(midiif.devid));
    midiif.RequestPatch();
    DispPatchName(currentpatch);
    DispPatch();
    if(autosave)
      StorePatch(currentpatch);
    ev.target.parentNode.parentNode.style.display="none";
  },
  {x:(rc.left-100+window.pageXOffset), y:(rc.top+24+window.pageYOffset)},
  );
  PopupPatchCancel2();
}
function PopupEdit(f,p,par){
  var tar=document.getElementById("f"+f+"p"+p+"v");
  var rc=tar.getBoundingClientRect();
  var offs;
  var panel=document.getElementById("popupeditpanel");
  var top=(377+(f-1)*42);
  var left=190+(p-1)*96;
  if(f>=5) top-=115;
  panel.onclick=(ev)=>{
    ev.stopPropagation();
  }
  switch(typeof(par.disp)){
  case "object": 
    if(typeof(par.disp.min)=="undefined"){
      var s=`<div style='height:${par.disp.length*20}px'>`;
      for(let i=0;i<par.disp.length;++i){
        s+=`<button>${par.disp[i]}</button><br/>`;
      }
      s+="</div>";
      panel.innerHTML=s;
      panel.style.left=left+"px";
      panel.style.top=top+"px";
      panel.style.display="block";
      for(let i=0;i<par.disp.length;++i){
        var e=panel.childNodes[0].childNodes[i*2];
        e.onclick=()=>{
          SetParamVal(currentpatch,f-1,p+1,i);
          DispPatch(currentpatch);
          panel.style.display="none";
        };
      }
    }
    else{
      var s=`<div style='height:${par.disp.list.length*20}px'><div>Range : ${par.disp.min} .. ${par.disp.max-1}</div><input value="${GetParamVal(currentpatch,f-1,p+1)+par.disp.min}" style="margin-bottom:4px"/><br/>`;
      for(let i=0;i<par.disp.list.length;++i){
        s+=`<button>${par.disp.list[i]}</button><br/>`;
      }
      s+="</div>";
      panel.innerHTML=s;
      panel.style.left=left+"px";
      panel.style.top=top+"px";
      panel.style.display="block";
      for(let i=0;i<par.disp.list.length;++i){
        var e=panel.childNodes[0].childNodes[(i+1)*2+1];
        e.onclick=()=>{
          console.log(par.disp.max+i)
          SetParamVal(currentpatch,f-1,p+1,par.disp.max+i-par.disp.min);
          DispPatch(currentpatch);
          panel.style.display="none";
        };
      }
      var input=panel.childNodes[0].childNodes[1];
      input.focus();
      input.selectionStart=input.selectionEnd=100;
      input.onkeydown=(ev)=>{
        console.log(ev.key);
        switch(ev.key){
        case "Enter":
          var val=input.value;
          if(val<par.disp.min) val=par.disp.min;
          if(val>=par.max+par.disp.min) val=par.max+par.disp.min;
          val-=par.disp.min;
          if(isNaN(val)) val=0;
          SetParamVal(currentpatch,f-1,p+1,val);
          panel.style.display="none";
          DispPatch(currentpatch);
          break;
        case "Escape":
          panel.style.display="none";
          break;
        }
      }
    }
    return;
  case "undefined": offs=0; break;
  case "number": offs=par.disp; break;
  }
  panel.innerHTML=`<div>Range : ${offs} .. ${offs+par.max}</div><input value="${GetParamVal(currentpatch,f-1,p+1)+offs}"/>`;
  panel.style.top=top+"px";
  panel.style.left=left+"px";
  panel.style.display="block";
  PopupPatchCancel2();
  var input=panel.childNodes[1];
  input.focus();
  input.selectionStart=input.selectionEnd=100;
  input.onkeydown=(ev)=>{
    console.log(ev.key);
    switch(ev.key){
    case "Enter":
      var val=input.value;
      if(val<offs) val=offs;
      if(val>=par.max+offs) val=par.max+offs;
      val-=offs;
      if(isNaN(val)) val=0;
      SetParamVal(currentpatch,f-1,p+1,val);
      panel.style.display="none";
      DispPatch(currentpatch);
      break;
    case "Escape":
      panel.style.display="none";
      break;
    }
  }
  input.onblur=()=>{
    panel.style.display="none";
  };
}
function PopupPatchRename(){
  document.getElementById("inputtext").value=patches[currentpatch].name;
  var tar=document.getElementById((currentpatch+1)+"nam");
  document.getElementById("inputmsg").innerHTML="Rename Patch";
  var rc=tar.getBoundingClientRect();
  document.getElementById("inputbase").style.display="block";
  var panel=document.getElementById("inputpanel");
  panel.style.left=(rc.left-120+window.pageXOffset)+"px";
  panel.style.top=(rc.top+20+window.pageYOffset)+"px";
  document.getElementById("inputtext").focus();
  PopupPatchCancel2();
  document.getElementById("inputok").onclick=function(ev){
    var i;
    var name=document.getElementById("inputtext").value;
    var p=currentpatch;
    patches[p].name=name.substr(0,10);
    DispPatchName(p);
    midiif.SendCurrentPatch();
    if(autosave)
      StorePatch(currentpatch);
    document.getElementById("inputbase").style.display="none";
  };
}
function SelectPort(){
  if(midioutputs.length>0){
    midiif.midiout=midioutputs[document.getElementById("midiport").selectedIndex];
    if(midiif.midiout && midiif.midiout.name!="ZOOM MS Series")
      midiif.midiout=null;
  }
}
function GetEffectId(p,n){
  return GetParamVal(p,n,1);
}
function GetDspState(p,n){
  if(midiif.devid==0x5f){
    return (patches[p].data[88]>>n)&1;
  }
  else{
    return (patches[p].data[129]>>n)&1;
  }
}
function GetParamVal(p,n,param){
  var pat=patches[p];
  if(!pat)
    return 0;
  return pat.fx[n][param];
}
function SetParamVal(p,n,param,val){
  var pat=patches[p];
  if(!pat)
    return 0;
  pat.fx[n][param]=val;
}
function GetCurrentEffect(){
  var pat=patches[currentpatch];
  if(!pat)
    return 0;
  var len=pat.data.length;
  if(len>=146)
    return 6-(((pat.data[130]&1)<<2)+((pat.data[125]&8)>>2)+((pat.data[129]&0x40)>>6));
  else
    return 3-(((pat.data[88]&0x40)>>6)+((pat.data[85]&0x10)>>3));
}
function SetCurrentEffect(n){
  var pat=patches[currentpatch];
  if(!pat)
    return 0;
  pat.curfx=n;
}
function GetEffectMax(){
  var pat=patches[currentpatch];
  if(!pat)
    return 0;
  if(pat.length<146)
    return (pat.data[89]&0x1c)>>2;
  return (pat.data[130]&0x1c)>>2;
}
function SetEffectMax(n){
  var pat=patches[currentpatch];
  if(!pat)
    return 0;
  if(pat.length<146)
    pat.data[89]=(pat.data[89]&~0x1c)+((n<<2)&0x1c);
  else
    pat.data[130]=(pat.data[130]&~0x1c)+((n<<2)&0x1c);
}
function GetEffectFromId(id){
  var ef=[];
  if(!effectlist[id])
    id=0;
  var e=effectlist[id];
  id=parseInt(id);
  ef.push(1);
  ef.push(id);
  for(var i=0;i<e.param.length;++i)
    ef.push(e.param[i].def);
  for(;i<9;++i)
    ef.push(0);
  return ef;
}
function GetEffect(p,n){
  var ef=[];
  for(var i=0;i<11;++i)
    ef.push(GetParamVal(p,n,i));
  return ef;
}
function SetEffect(p,n,ef){
  for(var i=0;i<11;++i){
    SetParamVal(p,n,i,ef[i]);
  }
  DispPatch();
}
function GetEffectParams(p,n){
  var r=[];
  for(var i=0;i<9;++i)
    r.push(GetParamVal(p,n,i));
  return r;
}
function GetEffectState(p,n){
  return GetParamVal(p,n,0);
}
function SetEffectState(p,n,on){
  SetParamVal(p,n,0,on?1:0);
  if(p==currentpatch){
    var id=GetEffectId(p,n);
    if(midiif.dump==3)
      console.log("effectid:"+id.toString(16));
    var ef=effectlist[id];
    var c=document.getElementById("fnam"+(n+1));
    if(ef && id!=0 && on)
      c.classList.add("press");
    else
      c.classList.remove("press");
  }
}
function ToggleEffect(n){
  SetEffectState(currentpatch, n,GetEffectState(currentpatch,n)^1);
  midiif.SendCurrentPatch();
}
function DispPatchName(p){
  document.getElementById((p+1)+"nam").innerHTML=patches[p].name;
  for(var i=0;i<6;++i){
    var id=patches[p].GetEffectId(i);
    var on=patches[p].GetEffectState(i);
    var icon=document.getElementById((p+1)+"_"+(i+1));
    if(midiif.devid==0x5f &&i>=4){
      icon.style.display="none";
    }
    else{
      icon.style.display="block";
    }
    if(id)
      icon.classList.add("exist");
    else
      icon.classList.remove("exist");
    if(on)
      icon.classList.add("on");
    else
      icon.classList.remove("on");
  }
}
function DispPatch(patch){
  var efmax,n,p,cell;
  var dspgraph=document.getElementById("dspgraph");
  var tab=document.getElementById("effects");
  if(typeof(patch)=="undefined")
    patch=currentpatch;
  efmax=(midiif.devid==0x5f)?4:6;
  dspgraph.style.height=42*efmax+"px";
  var dspsum=0;
  for(n=0;n<efmax;++n){
    var id=patches[patch].GetEffectId(n);
    var ef=effectlist[id];
    if(!ef)
      id=0,ef=effectlist[0];
    var b=dspgraph.childNodes[n];
//    b.style.height=(ef.dspmax+ef.dspmin)*50+"%";
    b.style.height=(1/ef.dsp)*100+"%";
    b.style.background=ef.col;
    var c=document.getElementById("fnam"+(n+1));
    var t=document.getElementById("ftxt"+(n+1));
    var img=document.getElementById("fimg"+(n+1));
    var full=document.getElementById("full"+(n+1));
    full.src=patches[patch].GetDspState(n)?"./images/dspfull.png":"./images/THRU.png";
    if(ef){
      full.title=ef.title;
      img.src="./images/"+ef.name.replace(/ /g,"_")+".png";
      if(ef.name=="THRU")
        c.classList.add("thru");
      else
        c.classList.remove("thru");
      t.innerHTML=ef.name;
    }
    else{
      full.title="";
      img.src="";
      t.innerHTML="unknown";
    }
    if(ef && id!=0 && patches[patch].GetEffectState(n))
      c.classList.add("press");
    else
      c.classList.remove("press");
    if(ef){
      for(p=0;p<9;++p){
        cell=tab.rows[n].cells[p+1];
        var s="f"+(n+1)+"p"+(p+1);
        var el=document.getElementById(s+"l");
        var ek=document.getElementById(s+"k");
        var es=document.getElementById(s+"s");
        var ev=document.getElementById(s+"v");
        if(p<ef.param.length){
          el.innerHTML=ef.param[p].name;
          ev.style.display="block";
          if(ef.param[p].max==1){
            es.style.display="block";
            ek.style.display="none";
          }
          else{
            es.style.display="none";
            ek.style.display="block";
          }
          var v=patches[patch].GetParamVal(n,p+2);
          if(typeof(ef.param[p].max)=="object"){
            for(var k=ef.param[p].max.length-1;k>=0;--k){
              if(ef.param[p].max[k]==v){
                v=k;
                break;
              }
            }
          }
          var ds=ef.param[p].disp;
          switch(typeof(ds)){
          case "number":
            var dr=ef.param[p].dispr;
            if(dr>0){
              if(dr<1){
                ev.innerHTML=(v*dr+ds).toFixed(1);
              }
              else
                ev.innerHTML=v*dr+ds;
            }
            else
              ev.innerHTML=v+ds;
            break;
          case "object":
            if(ds.type=="Time"){
              const t=v+ds.min;
              if(t>=ds.max){
                ev.innerHTML=ds.list[t-ds.max];
              }
              else
                ev.innerHTML=t;
            }
            else
              ev.innerHTML=ds[v];
            break;
          default:
            ev.innerHTML=v;
          }
          if(typeof(ef.param[p].max)=="object"){
              ek.max=ef.param[p].max.length-1;
              ek.tab=ef.param[p].max;
              ek.setValue(v);
          }
          else{
            ek.max=ef.param[p].max;
            ek.tab=null;
            ek.defvalue=ef.param[p].def;
            es.defvalue=ef.param[p].def;
            if(ek.setValue)
              ek.setValue(v);
            if(es.setValue)
              es.setValue(v);
          }
        }
        else{
          el.innerHTML="";
          ek.style.display="none";
          ev.style.display="none";
          es.style.display="none";
        }
      }
    }
  }
}
function SelectPatch(p){
  p=parseInt(p);
  if(p<0)
    return;
  if(p==currentpatch)
    return;
  midiif.Send([0xc0,p]);
  SetPatchFocus(0);
  currentpatch=p;
  SetPatchFocus(1);
  DispPatch();
}
function SetPatchFocus(f){
  if(currentpatch<0)
    return;
  c=document.getElementById((currentpatch+1)+"nam");
  if(f)
    c.classList.add("sel");
  else
    c.classList.remove("sel");
}
function SendPatch(p){
  p=parseInt(p);
  midiif.Send(patches[p].MakeBin(midiif.devid));
}
function StorePatch(p,callback){
  console.log("store:"+p);
  var cmd=[0xf0,0x52,0x00,midiif.devid,0x32,0x01,0x00,0x00,0x2c,0x00,0x00,0x00,0x00,0x00,0xf7];
  cmd[8]=p;
  if(callback){
    midiif.SendWait(cmd,midiif.sysexhead+"00",callback);
  }
  else
    midiif.Send(cmd);
}
function InstallChecker(){
  this.list=[];
  this.n=0;
  this.norg=0;
  this.porg=new apatch();
  this.Start=function(){
    this.norg=currentpatch;
    this.porg.CopyFrom(patches[49]);
    SelectPatch(49);
    this.n=0;
    for(var id in effectlist){
      if(effectlist[id].install==0){
        effectlist[id].install=-1;
        document.getElementById("e_"+id).classList.add("notinstall");
        this.list.push(parseInt(id));
      }
    }
    if(this.list.length>0){
      document.getElementById("waitmsg").innerHTML="";
      document.getElementById("waitbase").style.display="block";
    }
  };
  this.timer=function(){
    if(this.list.length<=0)
      return;
    document.getElementById("waitmsg").innerHTML="Effect Install Check...("+this.list.length+")";
    while(this.n<4&&this.list.length>0){
      SetEffect(currentpatch,this.n,GetEffectFromId(this.list.shift()));
      ++this.n;
    }
    this.n=0;
    midiif.Send(patches[currentpatch].MakeBin(midiif.devid));
    midiif.Send([0xf0,0x52,0,midiif.devid,0x29,0xf7]);
    if(this.list.length<=0){
      setTimeout(function(){
        midiif.Send(this.porg.MakeBin(midiif.devid));
        patches[49].CopyFrom(this.porg);
        DispPatchName(currentpatch);
        DispPatch();
        SelectPatch(currentpatch);
        document.getElementById("waitbase").style.display="none";
      }.bind(this),700);
    }
  };
  this.ShowAll=function(f){
    for(id in effectlist){
      var el=document.getElementById("e_"+id);
      if(el){
        if(f)
          el.style.display="inline-block";
        else{
          var ef=effectlist[id];
          if(ef.install>=-1)
            el.style.display="inline-block";
          else
            el.style.display="none";
        }
      }
    }
  };
  setInterval(this.timer.bind(this),500);
}
function InstallCheck(){
  document.getElementById("effectpanelmsg").innerHTML="Install Check";
  document.getElementById("effectpanelbase").style.display="block";
  inst.Start();
}
function SavePatchToDevice(){
  StorePatch(currentpatch,function(){});
}
function SaveAllToDevice(){
  var saver=new StoreAll();
}
function AutoSave(){
  var btn=document.getElementById("autosavebtn");
  if(btn){
    if(btn.style.background==""){
        btn.style.background="linear-gradient(#c33,#b22)";
        btn.style.color="#fff";
        document.getElementById("devsavebtn").disabled=true;
        autosave=1;
    }
    else{
      btn.style.background="";
      btn.style.color="#000";
      document.getElementById("devsavebtn").disabled=false;
      autosave=0;
    }
    document.cookie="autosave="+autosave;
  }
}
function Tuner(){
  var btn=document.getElementById("tunerbtn");
  if(btn.style.background==""){
      btn.style.background="linear-gradient(#c33,#b22)";
      btn.style.color="#fff";
      midiif.Send([0xb0,0x4a,0x7f]);
  }
  else{
    btn.style.background="";
    btn.style.color="#000";
    midiif.Send([0xb0,0x4a,0x00]);
  }
}
function Usage(){
  var e=document.getElementById("usagebase");
  if(e.style.display!="block"){
    e.style.display="block";
  }
  else{
    e.style.display="none";
  }
}
function SaveBank(){
  var p;
  var zip=new JSZip();
  for(p=0;p<50;++p){
    var s=MakeStr(patches[p].MakeBin(midiif.devid))+"\r\n";
    var n=("0"+(p+1)).substr(-2)+"@"+(patches[p].name.replace(/ +/g,"").replace(/ /g,"_"))+"."+midiif.devstr;
    zip.file(n,s);
  }
  zip.generateAsync({type:"blob"}).then(function (blob) {
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.target="_blank";
    a.download="newbank."+midiif.devstr+".zip";
    a.click();
  });
}
function StoreAll(callback){
  document.getElementById("waitmsg").innerHTML="Storing...";
  document.getElementById("waitbase").style.display="block";
  this.res=[];
  this.cnt=0;
  this.ready=0;
  this.cb=callback;
  this.Next=function(){
    if(this.cnt>=50){
      document.getElementById("waitbase").style.display="none";
      this.ready=1;
      if(this.cb)
        this.cb();
      return;
    }
    document.getElementById("waitmsg").innerHTML="Storing...("+this.cnt+"/50)";
    midiif.SendDirect([0xc0,this.cnt]);
    midiif.SendDirect(patches[this.cnt].MakeBin(midiif.devid));
    StorePatch(this.cnt++,this.Next.bind(this));
  };
  this.Next();
}
function LoadBank(){
  var i=document.createElement("input");
  i.type="file";
  i.click();
  i.addEventListener("change",function(ev){
    var file=ev.target.files;
    var reader=new FileReader();
    var zip=new JSZip();
    var cnt=0;
    if(file[0].name.substr(-4)==".zip"){
      reader.onload=function(ev){
        zip.loadAsync(reader.result).then(
          function(zip){
            console.log("loadbank");
            Confirm("Overwrite all patches, Sure?",
              function(ev){
                ev.target.parentNode.parentNode.style.display="none";
                zip.forEach(function(name,c){
                  zip.file(name).async("string").then(function(txt){
                    var n=parseInt(name.substr(0,2))-1;
                    var bin=MakeBin(txt,146);
                    patches[n].ReadBin(bin);
                    if(bin[3]!=midiif.devid){
                      AlertMsg("This patch is not for "+midiif.devstr);
                      return;
                    }
                    DispPatchName(n);
                    if(autosave){
                      if(++cnt>=50){
                        new StoreAll(function(){
                          document.getElementById("waitbase").style.display="none";
                        });
                      }
                    }
                  });
                });
              }
            );
          }
        )
      };
      reader.readAsArrayBuffer(file[0]);
    }
    else{
      reader.readAsText(file[0]);
      reader.onload=function(ev){
        if(reader.result.indexOf("1:f052005828")!=0){
          AlertMsg("Bank file error");
          return;
        }
        var s=reader.result.split("\n");
        for(var i=0;i<50;++i){
          s[i]=s[i].split(":");
          patches[i].ReadBin(MakeBin(s[i][1],146));
          DispPatchName(i);
        }
        if(autosave){
          new StoreAll(function(){
            document.getElementById("waitbase").style.display="none";
          });
        }
      }
    }
  },false);
}
function ShowPatch(){
  var p=currentpatch;
  if(p<0)
    return;
  var n=patches[p].name;
  var fname=n.replace(/\s+$/,"").replace(/ /g,"_");
  var d=MakeStr(patches[p].MakeBin(midiif.devid));
  AlertMsg("Show Patch As Text <br/><textarea disabled style='width:360px;height:100px'>"+d+"</textarea>");
}
function ExportPatch(){
  var p=currentpatch;
  if(p<0)
    return;
  var n=patches[p].name;
  var fname=n.replace(/\s+$/,"").replace(/ /g,"_");
  var d=MakeStr(patches[p].MakeBin(midiif.devid));
  var blob=new Blob([d],{"type":"text/plain"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.target="_blank";
  a.download=fname+"."+midiif.devstr;
  a.click();
}
function ReadPatch(data){
  if(data[3]!=midiif.devid){
    Confirm("This patch is not for MS-"+midiif.devstr+".<br/> Load anyway ?",function(ev){
      data[3]=midiif.devid;
      ev.target.parentNode.parentNode.style.display="none";
      ReadPatch(data);
    });
    return;
  }
  patches[currentpatch].ReadBin(data);
  DispPatchName(currentpatch);
  DispPatch(currentpatch);
  SelectPatch(currentpatch);
  midiif.SendCurrentPatchVerify(function(s){
    if(s)
      AlertMsg("Following effect(s) are not exist<br/>"+s);
    console.log(s);
  });
  if(autosave)
    StorePatch(currentpatch);
}
function ImportPatch(){
  var p=currentpatch;
  if(p<0)
    return;
  var i=document.createElement("input");
  i.type="file";
  i.click();
  i.addEventListener("change",function(ev){
    var file=ev.target.files;
    if(file[0].name.substr(-4)==".zip"){
      document.getElementById("patchenum").style.display="block";
      var reader=new FileReader();
      var zip=new JSZip();
      var cnt=0;
      reader.onload=function(ev){
        zip.loadAsync(reader.result).then(
          function(zip){
            for(var i=0;i<50;++i)
              document.getElementById("patchenumlist").rows[i%10].cells[(i/10)|0].innerHTML="";
            zip.forEach(function(name,c){
              zip.file(name).async("string").then(function(txt){
                var n=parseInt(name.substr(0,2))-1;
                var e=document.createElement("button");
                e.setAttribute("class","patchbtn");
                e.data=MakeBin(txt,146);
                name=name.replace(/.50g$/,"").replace(/.60b$/,"").replace(/.70cdr$/,"");
                e.innerHTML=name;
                document.getElementById("patchenumlist").rows[n%10].cells[(n/10)|0].appendChild(e);
                e.onclick=function(){
                  ReadPatch(this.data);
                  document.getElementById("patchenum").style.display="none";
                }
              });
            });
          }
        );
      };
      reader.readAsArrayBuffer(file[0]);
      return;
    }
    var reader=new FileReader();
    reader.readAsText(file[0]);
    reader.onload=function(ev){
      var data=MakeBin(reader.result,146);
      ReadPatch(data);
    }
  },false);
}
function ImportText(){
  var tar=document.getElementById((currentpatch+1)+"nam");
  var panel=document.getElementById("textareabase");
  document.getElementById("textareamsg").innerHTML="Load from Text : Paste here the Text from 'Show Patch as text'<br/> or guitarpatches.com's zoom MS-50G patch page texts.";
  document.getElementById("textareatext").value="";
  var rc=tar.getBoundingClientRect();
  panel.style.display="block";
  PopupPatchCancel2();
  document.getElementById("textareaok").onclick=function(ev){
    var str=document.getElementById("textareatext").value;
    var h=str.indexOf("f05200");
    if(h>=0){
      var str=str.substr(h);
      var data=MakeBin(str,146);
      console.log(data);
      var len=0;
      if(data[145]==0xf7) len=146;
      if(data[104]==0xf7) {
        len=105;
        data=slice(0,105);
      }
      console.log(data);
      if(len){
        ReadPatch(data);
        document.getElementById("textareabase").style.display="none";
        return;
      }
    }
    var tx=str.split("\n");
    var param=0;
    var id=0;
    var found=0;
    var name="";
    for(var l=0,m=tx.length;l<m;++l){
      if(tx[l].indexOf("Description")==0 && l>0){
        for(var ll=l-1;ll>=0&&ll>=l-2;--ll)
          if(tx[ll].length>0)
            name=tx[ll].substr(0,10);
      }
      if(tx[l].indexOf("EFFECT")==0){
        var n=parseInt(tx[l][7])-1;
        if(n>=0 && n<6){
          found=1;
          var enam=tx[l].split(":")[1].substr(1);
          if(enam=="OFF")
            enam="THRU";
          for(id in effectlist){
            if(effectlist[id].name==enam){
              SetEffect(currentpatch,n,GetEffectFromId(id));
              break;
            }
          }
        }
      }
      if(param>=2&&param<11){
        var v=parseInt(tx[l]);
        var pm=effectlist[id].param[param-2];
        if(pm){
          if(typeof(pm.disp)=="number"){
            v-=pm.disp;
          }
          else if(typeof(pm.disp)=="object"){
            for(v=0;v<pm.disp.length;++v){
              if(pm.disp[v].toLowerCase().indexOf(tx[l].toLowerCase())==0){
                break;
              }
            }
            if(v==pm.disp.length)
              v=0;
            if(typeof(pm.max)=="object")
              v=pm.max[v];
          }
          SetParamVal(currentpatch,n,param,v);
        }
        param=0;
      }
      if(tx[l].indexOf("Page")==0){
        var t=tx[l].split("-");
        param=parseInt(t[0].substr(4))*3+parseInt(t[1].substr(4))-2;
      }
    }
    if(found){
      patches[currentpatch].name=name;
      DispPatchName(currentpatch);
      DispPatch(currentpatch);
      SelectPatch(currentpatch);
      midiif.SendCurrentPatchVerify(function(s){
        if(s)
          AlertMsg("Following effect(s) are not exist<br/>"+s);
        console.log(s);
      });
      if(autosave)
        StorePatch(currentpatch);
    }
    else {
      AlertMsg("No patch data is found.");
    }
    document.getElementById("textareabase").style.display="none";
  };
}
function OpenUrl(url){
  window.open(url);
}
function ShowDoc(x) {
  var divs=document.getElementsByTagName("div");
  var t="doc_"+x;
  for(var i=0;i<divs.length;++i) {
    if(divs[i].className==="doc_ja")
      divs[i].style.display=(x==="ja")?"block":"none";
    if(divs[i].className=="doc_en")
      divs[i].style.display=(x==="ja")?"none":"block";
  }
}
function GetLang() {
  return (navigator.language || navigator.browserLanguage).substring(0, 2);
}
window.addEventListener("load",Init);
