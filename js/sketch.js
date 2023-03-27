function setup() {

  //noStroke();

  // Enable WebMidi.js and trigger the onWebMidiEnabled() function when ready.
  WebMidi.enable()
    .then(onWebMidiEnabled)
    .catch(err => alert(err));

}

function onWebMidiEnabled() {

  // Check if at least one MIDI input is detected. If not, display warning and quit.
  if (WebMidi.inputs.length < 1) {
    alert("No MIDI inputs detected.");
    return;
  }

  // Add a listener on all the MIDI inputs that are detected
  WebMidi.inputs.forEach(input => {

	if (input.name.includes('MIDISPORT')
		|| input.name.includes('PODxt Live')
	    || input.name.includes('Line 6 POD X3 Live')
	){
		// When a "note on" is received on MIDI channel 1, do...
		input.channels[1].addListener("programchange", function(p) {
		  //fill(random(255), random(255), random(255));
		  //circle(random(width), random(height), 100);
		  if (!isNaN(p.value)){			
			let patchValue;
			let zoomLimit = 49;
			let offset = false;//true for Pod Floor plus
			if (input.name.includes('MIDISPORT') && offset) {
				console.log('offset true');
			  patchValue = p.value -1; //offset midi floor pod plus				  
			}
			else{
			  patchValue = p.value;				   
			}
			while (patchValue > zoomLimit){
				patchValue -= zoomLimit;
			}			  
			SendPatch(patchValue);
			console.log('program X:' + patchValue);
		  }
		  else{
			  console.log('program Error');
		  }
		});
	}
		else{
			// When a "note on" is received on MIDI channel 1, do...
			
		}
  });
	  
  // Print available MIDI outputs
  for(let i = 0; i < WebMidi.outputs.length; i++){
	console.log('Outputs sketch:' + WebMidi.outputs[i].name);
  }
  
  // From the list on the console, pick an output name:
  // midiOutput = WebMidi.getOutputByName("IAC Driver IAC Bus 1");
  midiOutput = WebMidi.getOutputByName("MIDISPORT");
	
}
