var audioCtx;
var waveform;
var synthesisMode;
var modulatorFreqAM;
var modulatorFreqFM;
var modulationIndex;
var globalGain;
const maxOverallGain = 0.8;
var activeOscillators = {};
const startButton = document.querySelector('#startButton');
const waveformButtons = document.querySelectorAll('input[name="waveform"]');
const synthesisModeButtons = document.querySelectorAll('input[name="synthesisMode"]');
const lfoCheckbox = document.getElementById("lfoCheckbox");
const nonSynthesisCheckbox = document.getElementById("nonSynthesisCheckbox");
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

const keyboardColorMap = {
    '90': '#FFCCCC',   // Z - C (Light Coral)
    '83': '#FFD700',   // S - C# (Gold)
    '88': '#98FB98',   // X - D (Pale Green)
    '68': '#ADD8E6',   // D - D# (Light Blue)
    '67': '#FFB6C1',   // C - E (Light Pink)
    '86': '#FFDAB9',   // V - F (Peach Puff)
    '71': '#87CEFA',   // G - F# (Light Sky Blue)
    '66': '#FF69B4',   // B - G (Hot Pink)
    '72': '#90EE90',   // H - G# (Light Green)
    '78': '#FFA07A',   // N - A (Light Salmon)
    '74': '#F0E68C',   // J - A# (Khaki)
    '77': '#FFDEAD',   // M - B (Navajo White)
    '81': '#FFB6C1',   // Q - C (Light Pink)
    '50': '#F0E68C',   // 2 - C# (Khaki)
    '87': '#FFDAB9',   // W - D (Peach Puff)
    '51': '#98FB98',   // 3 - D# (Pale Green)
    '69': '#ADD8E6',   // E - E (Light Blue)
    '82': '#FFA07A',   // R - F (Light Salmon)
    '53': '#FF69B4',   // 5 - F# (Hot Pink)
    '84': '#87CEFA',   // T - G (Light Sky Blue)
    '54': '#90EE90',   // 6 - G# (Light Green)
    '89': '#FFCCCC',   // Y - A (Light Coral)
    '55': '#FFD700',   // 7 - A# (Gold)
    '85': '#FFB6C1',   // U - B (Light Pink)
};

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
      changeBackgroundColor(key);
      displayEmoji();
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

    function non_synthesis() {
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(keyboardFrequencyMap[key], audioCtx.currentTime);
        osc.connect(gainNode).connect(globalGain)
        osc.start();
        oscillators.push(osc);

        if (lfoCheckbox.checked) {
            let lfo = audioCtx.createOscillator();
            lfo.frequency.value = 2;
            lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 10;
            lfo.connect(lfoGain).connect(osc.frequency);
            oscillators.push(lfo);
            lfo.start();
        }
    }

    // Additive Synthesis
    function additive() {
        let partialCount = document.getElementById("partialCount").value;
        for (let i = 0; i < partialCount; i++) {
            osc = audioCtx.createOscillator();
            osc.frequency.value = freq * (i + 1) + Math.random() * 15
            osc.type = waveform;
            osc.connect(gainNode).connect(globalGain);
            oscillators.push(osc);
            osc.start();

            if (lfoCheckbox.checked && i % 2 == 1) {
                let lfo = audioCtx.createOscillator();
                lfo.frequency.value = 0.5;
                lfoGain = audioCtx.createGain();
                lfoGain.gain.value = 8;
                lfo.connect(lfoGain).connect(osc.frequency);
                oscillators.push(lfo);
                lfo.start();
            }
        }
        
    }

    function amplitude_modulation() {
        let carrier = audioCtx.createOscillator();
        modulatorFreqAM = audioCtx.createOscillator();
        modulatorFreqAM.frequency.value = document.getElementById("amFrequency").value;
        carrier.frequency.value = freq;

        const modulated = audioCtx.createGain();
        const depth = audioCtx.createGain();
        depth.gain.value = 0.5 //scale modulator output to [-0.5, 0.5]
        modulated.gain.value = 1.0 - depth.gain.value; //a fixed value of 0.5

        modulatorFreqAM.connect(depth).connect(modulated.gain); //.connect is additive, so with [-0.5,0.5] and 0.5, the modulated signal now has output gain at [0,1]
        carrier.connect(modulated)
        modulated.connect(gainNode).connect(globalGain);

        oscillators.push(carrier);
        oscillators.push(modulatorFreqAM);
        
        carrier.start();
        modulatorFreqAM.start();

        if (lfoCheckbox.checked) {
            let lfo = audioCtx.createOscillator();
            lfo.frequency.value = 2;
            lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 300;
            lfo.connect(lfoGain).connect(modulatorFreqAM.frequency);
            oscillators.push(lfo);
            lfo.start();
        }
        
    }

    function frequency_modulation() {
        let carrier = audioCtx.createOscillator();
        modulatorFreqFM = audioCtx.createOscillator();
        carrier.frequency.value = freq;

        modulationIndex = audioCtx.createGain();
        modulationIndex.gain.value = document.getElementById("fmIndex").value;
        modulatorFreqFM.frequency.value = document.getElementById("fmFrequency").value;

        modulatorFreqFM.connect(modulationIndex);
        modulationIndex.connect(carrier.frequency)
        
        carrier.connect(gainNode).connect(globalGain);
        oscillators.push(carrier);
        oscillators.push(modulatorFreqFM);
        carrier.start();
        modulatorFreqFM.start();

        if (lfoCheckbox.checked) {
            let lfo = audioCtx.createOscillator();
            lfo.frequency.value = 2;
            lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 300;
            lfo.connect(lfoGain).connect(modulatorFreqFM.frequency);
            oscillators.push(lfo);
            lfo.start();
        }
    }

    if (nonSynthesisCheckbox.checked) {
        non_synthesis();
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

function updateFreqAM(val) {
    if (amCheckbox.checked) {
        modulatorFreqAM.frequency.value = val;
    }
};

function updateFreqFM(val) {
    if (fmCheckbox.checked) {
        modulatorFreqFM.frequency.value = val;
    }
};

function updateIndex(val) {
    if (fmCheckbox.checked) {
        modulationIndex.gain.value = val;
    }
};

function updateGlobalGain() {
    let gainSum = 0;
    for (const key in activeOscillators) {
        gainSum += activeOscillators[key].gainNode.gain.value;
    }
    const newGlobalGain = maxOverallGain / Math.max(1, gainSum);
    globalGain.gain.setValueAtTime(newGlobalGain, audioCtx.currentTime);
};

function changeBackgroundColor(key) {
    const color = keyboardColorMap[key];
    if (color) {
        document.body.style.backgroundColor = color;
    }
}

function displayEmoji() {
    const emojis = ['🌞', '🌈', '💫', '🌸', '🌼', '🎉', '🎈', '🎊', '🍀', '🌟', '🌻', '😊', '😎', '😄', '😃', '😁'];
    const randomIndex = Math.floor(Math.random() * emojis.length);
    const emoji = emojis[randomIndex];
    document.getElementById('emojiDisplay').textContent = emoji;
}