function setup() {

  //noStroke();

  // Enable WebMidi.js and trigger the onWebMidiEnabled() function when ready.
  WebMidi.enable()
    .then(onWebMidiEnabled)
    .catch(err => alert(err));

}

	function zoomProgramChanged(num){
		if(midiOutput){		
			let patchValue;
			let line6M5Limit = 24;
			let offset = false;//true for floor pod plus	
			if (midiOutput.name.includes('MIDISPORT') && offset) {
				console.log('offset true');
			    patchValue = num -1; //offset midi floor pod plus				  
			}
			else{
			  patchValue = num;				   
			}
			while (patchValue >= line6M5Limit){
				patchValue -= line6M5Limit;
			}		
		
			midiOutput.sendProgramChange(patchValue);
		}
		else{
			console.log("Looks like there is no MIDI output device. Check if your PC is connected.");
		}
	}

	function onWebMidiEnabled() {
		  
		  // Print available MIDI outputs
		  for(let i = 0; i < WebMidi.outputs.length; i++){
			console.log('Outputs: ' + WebMidi.outputs[i].name);
		  }
		  
		  // From the list on the console, pick an output name:
		  // midiOutput = WebMidi.getOutputByName("IAC Driver IAC Bus 1");
		  midiOutput = WebMidi.getOutputByName("MIDISPORT");

	}
