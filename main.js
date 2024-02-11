var audioCtx;
var waveform;
var synthesisMode;
var partialCount = 3;
var modulatorFreq;
var modulationIndex;
var globalGain;
const maxOverallGain = 0.8;
var activeOscillators = {};
const startButton = document.querySelector('#startButton');
const waveformButtons = document.querySelectorAll('input[name="waveform"]');
const synthesisModeButtons = document.querySelectorAll('input[name="synthesisMode"]');
const additiveCheckbox = document.getElementById("additiveCheckbox");
const amCheckbox = document.getElementById("amCheckbox");
const fmCheckbox = document.getElementById("fmCheckbox");

// Hard-coding ADSR envelope 
var attackTime = 0.2;
var decayTime = 0.3;
var sustainTime = 0.3;
var releaseTime = 0.05;

const keyboardFrequencyMap = {
    '90': 261.625565300598634,  //Z - C
    '83': 277.182630976872096, //S - C#
    '88': 293.664767917407560,  //X - D
    '68': 311.126983722080910, //D - D#
    '67': 329.627556912869929,  //C - E
    '86': 349.228231433003884,  //V - F
    '71': 369.994422711634398, //G - F#
    '66': 391.995435981749294,  //B - G
    '72': 415.304697579945138, //H - G#
    '78': 440.000000000000000,  //N - A
    '74': 466.163761518089916, //J - A#
    '77': 493.883301256124111,  //M - B
    '81': 523.251130601197269,  //Q - C
    '50': 554.365261953744192, //2 - C#
    '87': 587.329535834815120,  //W - D
    '51': 622.253967444161821, //3 - D#
    '69': 659.255113825739859,  //E - E
    '82': 698.456462866007768,  //R - F
    '53': 739.988845423268797, //5 - F#
    '84': 783.990871963498588,  //T - G
    '54': 830.609395159890277, //6 - G#
    '89': 880.000000000000000,  //Y - A
    '55': 932.327523036179832, //7 - A#
    '85': 987.766602512248223,  //U - B
}

window.addEventListener('keydown', keyDown, false);
window.addEventListener('keyup', keyUp, false);

startButton.addEventListener("click", initializeAudioContext, false); 
waveformButtons.forEach(button => {
    button.addEventListener("change", setWaveform);
});
synthesisModeButtons.forEach(button => {
    button.addEventListener("change", setSynthesisMode);
});

function initializeAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        globalGain = audioCtx.createGain(); //this will control the volume of all notes
        globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime)
        globalGain.connect(audioCtx.destination);
        return;
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (audioCtx.state === 'running') {
        audioCtx.suspend();
    }
}

function setWaveform(event) {
    const selectedRadioButton = event.target;
    if (selectedRadioButton.checked) {
        waveform = selectedRadioButton.value;
    }
}

function setSynthesisMode(event) {
    const selectedRadioButton = event.target;
    if (selectedRadioButton.checked) {
        synthesisMode = selectedRadioButton.value;
    }
}

function keyDown(event) {
    const key = (event.detail || event.which).toString();
    if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
      playNote(key);
    }
}

function keyUp(event) {
    const key = (event.detail || event.which).toString();
    if (keyboardFrequencyMap[key] && activeOscillators[key]) {
        const { osc, gainNode } = activeOscillators[key];
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, releaseTime);
        delete activeOscillators[key];
    }
}

function playNote(key) {

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + attackTime); // Attack
    gainNode.gain.setTargetAtTime(0.2, audioCtx.currentTime + attackTime, decayTime); // Decay

    freq = keyboardFrequencyMap[key];
    oscillators = [];

    // Additive Synthesis
    function additive() {
        for (let i = 0; i < partialCount; i++) {
            osc = audioCtx.createOscillator();
            osc.frequency.value = freq * (i + 1) + Math.random() * 15
            osc.type = waveform;
            osc.connect(gainNode).connect(globalGain);
            oscillators.push(osc);
            osc.start();

            if (i == 0 || i == 2) {
                var lfo = audioCtx.createOscillator();
                lfo.frequency.value = 0.5;
                lfoGain = audioCtx.createGain();
                lfoGain.gain.value = 8;
                lfo.connect(lfoGain).connect(osc.frequency);
                lfo.start();
            }
        }
        
    }

    function amplitude_modulation() {
        var carrier = audioCtx.createOscillator();
        modulatorFreq = audioCtx.createOscillator();
        modulatorFreq.frequency.value = 100;
        carrier.frequency.value = freq;

        const modulated = audioCtx.createGain();
        const depth = audioCtx.createGain();
        depth.gain.value = 0.5 //scale modulator output to [-0.5, 0.5]
        modulated.gain.value = 1.0 - depth.gain.value; //a fixed value of 0.5

        modulatorFreq.connect(depth).connect(modulated.gain); //.connect is additive, so with [-0.5,0.5] and 0.5, the modulated signal now has output gain at [0,1]
        carrier.connect(modulated)
        modulated.connect(gainNode).connect(globalGain);
        
        carrier.start();
        modulatorFreq.start();

        var lfo = audioCtx.createOscillator();
        lfo.frequency.value = 2;
        lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 300;
        lfo.connect(lfoGain).connect(modulatorFreq.frequency);
        lfo.start();
    }

    function frequency_modulation() {
        var carrier = audioCtx.createOscillator();
        modulatorFreq = audioCtx.createOscillator();
        carrier.frequency.value = freq;

        modulationIndex = audioCtx.createGain();
        modulationIndex.gain.value = 100;
        modulatorFreq.frequency.value = 100;

        modulatorFreq.connect(modulationIndex);
        modulationIndex.connect(carrier.frequency)
        
        carrier.connect(gainNode).connect(globalGain);

        carrier.start();
        modulatorFreq.start();

        var lfo = audioCtx.createOscillator();
        lfo.frequency.value = 2;
        lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 300;
        lfo.connect(lfoGain).connect(modulatorFreq.frequency);
        lfo.start();
    }

    if (additiveCheckbox.checked) {
        additive();
    }
    if (amCheckbox.checked) {
        amplitude_modulation();
    }
    if (fmCheckbox.checked) {
        frequency_modulation();
    }

    activeOscillators[key] = { oscillators, gainNode };
    updateGlobalGain();
};

function updatePartialCount(val) {
    if (additiveCheckbox.checked) {
        partialCount = val;
    }
}

function updateFreq(val) {
    if (amCheckbox.checked || fmCheckbox.checked) {
        modulatorFreq.frequency.value = val;
    }
};

function updateIndex(val) {
    if (fmCheckbox.checked) {
        modulationIndex.gain.value = val;
    }
};

function updateGlobalGain() {
    var gainSum = 0;
    for (const key in activeOscillators) {
        gainSum += activeOscillators[key].gainNode.gain.value;
    }
    const newGlobalGain = maxOverallGain / Math.max(1, gainSum);
    globalGain.gain.setValueAtTime(newGlobalGain, audioCtx.currentTime);
};