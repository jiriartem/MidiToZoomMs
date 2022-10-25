function setup() {

  //noStroke();

  // Enable WebMidi.js and trigger the onWebMidiEnabled() function when ready.
  WebMidi.enable()
    .then(onWebMidiEnabled)
    .catch(err => alert(err));

}

function draw() {

}

function onWebMidiEnabled() {

  // Check if at least one MIDI input is detected. If not, display warning and quit.
  if (WebMidi.inputs.length < 1) {
    alert("No MIDI inputs detected.");
    return;
  }

  // Add a listener on all the MIDI inputs that are detected
  WebMidi.inputs.forEach(input => {

	if ((input.name == '3- MIDISPORT Uno / 1x1 In') 
		|| (input.name == 'Line 6 PODxt Live')){
		// When a "note on" is received on MIDI channel 1, generate a random color start
		input.channels[1].addListener("programchange", function(p) {
		  //fill(random(255), random(255), random(255));
		  //circle(random(width), random(height), 100);
		  if (!isNaN(p.value)){
			  console.log('program X:' + patchValue);
			  var patchValue;
			  var zoomLimit = 50;
			  if (input.name == '3- MIDISPORT Uno / 1x1 In') {
				  patchValue = p.value -1; //offset midi floor pod plus
				  zoomLimit = 49;
			  }
			  else{
				  patchValue = p.value;				   
			  }
				while (patchValue > zoomLimit){
					patchValue -= zoomLimit;
				}			  
			  SendPatch(patchValue);
		  }
		  else{
			  console.log('program Error');
		  }
		});
	}
	
	if (input.name == 'ZOOM G Series'){
		// When a "note on" is received on MIDI channel 1, generate a random color start
		input.channels[1].addListener("programchange", function(p) {
		  //fill(random(255), random(255), random(255));
		  //circle(random(width), random(height), 100);
		  if (!isNaN(p.value)){
			  console.log('program X:' + patchValue);
			  var patchValue = p.value -1;
			  var zoomLimit = 44;
			  while (patchValue > zoomLimit){
					patchValue -= zoomLimit;
				}
				SendPatch(patchValue);
		  }
		  else{
			  console.log('program Error');
		  }
		});
	}
  });

}
