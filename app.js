/**
 * Experimentation with async / await.
 *
 * The aim is to produce a re-usable way of splitting a sequence into steps,
 * usable in a game loop. Each step is performed in order, but delayed to allow
 * the user to see the result of steps unfolding. The steps are pausable to
 * allow reviewing history.
 *
 * A UI is constructed with pause/play/ffwd controls to simulate the
 * experience.    
 */


/* Base functions and decorators */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));


/**
 * Delay f() with a configurable delay time.
 *
 * Decorates f() with a wrapper which first delays execution by a given delay
 * time, then calls the function with any passed arguments and returns its
 * return value.
 *
 * Takes an `options` object with a `delayTime` property to determine how long
 * to delay. Make this dynamic to control the delay externally.
 *
 * @param f Function to decorate. Arguments to the decorator are passed to it.
 * @param options Object with settings to control the delay.
 *                Supports `delayTime` in miliseconds.
 *                Default: {delayTime: 2000}.
 * @returns An asynchronous function around f().
 * TODO Re-evaluate the need for `this` and apply.
 * TODO Re-evaluate the args. Pass functions to get pause state, settings?
 */
const delayable = (f, options) => {
    options = options || {delayTime: 2000};
    // The returned function must be `async` to allow usage of `await`. 
    return async (...arguments) => {
        await sleep(options.delayTime); // Stop execution until this completes.
        console.log("Delayed by", options.delayTime)
        // Return whatever value, including potential Promise objects.
        // The calling code will need to figure out what to do with this.
        return f.apply(this, arguments);  // TODO Re-evaluate need for `this`.
    }
};


/**
 * Continuously delay f() based on a pause state.
 *
 * Decorates f() with a wrapper which delays execution while a pause state is
 * set to `true`, then calls the function with any passed arguments and
 * returns its return value.
 *
 * Takes an `options` object with a `paused` property with the pause state.
 * Make this dynamic to control the pause externally.
 *
 * The pause state is checked each `checkInterval` miliseconds, also read from
 * `options`.
 *
 * @param f Function to decorate.
 * @param options Object with settings to control the pause.
 *                Supports `paused` to determine if execution is currently
 *                paused and `checkInterval` in miliseconds to control the
 *                interval to check for changes in the pause state.
 *                Default: {paused: false, checkInterval: 100}.
 * @returns An asynchronous function around f().
 * TODO Re-evaluate the need for `this` and apply.
 * TODO Re-evaluate the args. Pass functions to get pause state, settings?
 */
const pausable = (f, options) => {
    // XXX This is a bit silly. How would you alter pause state with a default?
    options = options || {checkInterval: 100, paused: false};
    return async (...arguments) => {    
        // Keep checking for the pause state until we're playing again.
        // while (true) would overwhelm the process, so await a delayed result.
        while (options.paused) {
            console.log("pausing for", options.checkInterval)
            await sleep(options.checkInterval);
        }
        // Return whatever value, including potential Promise objects.
        // The calling code will need to figure out what to do with this.
        return f.apply(this, arguments);
    }    
};


/**
 * Execute the function f() as a step that can be delayed and paused.
 *
 * Decorates f() with both `delayable()` and `pausable()`, delaying the
 * execution of the function and optionally pausing it depending on a pause
 * state. Passes any arguments to f() and returns its return value.
 *
 * Take an `options` object of the form
 * {
 *   delay: {
 *     delayTime: 2000
 *   },
 *   pause: {
 *     paused: false,
 *     checkInterval: 100
 *   }
 * }
 *
 * Make these dynamic to control them externally.
 *
 * @param f Function to decorate.
 * @param options Object with settings to control the delay and pause.
 *                Expects an object with two properties 'delay' and 'pause',
 *                whose values correspond to the `options` taken by
 *                `delayable()` and `pausable()`.
 *                Default: Default values for `deployable()` and `pausable()`.
 * @returns An asynchronous function around f().
 *
 * TODO Re-evaluate the implementation of options.
 */
const step = (f, options) => {
    options = options || {pause: null, delay: null};
    return delayable(pausable(f, options.pause), options.delay);
};


/* Step setup */

const PAUSE_CHECK_INTERVAL = 100;
const NORMAL_DELAY_TIME = 1000; 
const SHORT_DELAY_TIME = 500;

// Current speed and pause state.
// Modify these to change the behavior of the steps.
let delayTime = NORMAL_DELAY_TIME;
let paused = true;


// Pass an object with getters to allow changing the values after the fact.
// This could read or somehow be e.g. a Redux state.
const stepOptions = {
    delay: {
        get delayTime() { return delayTime; }
    },
    pause: {
        checkInterval: PAUSE_CHECK_INTERVAL,
        get paused() { return paused; }
    }
};


// Different types of steps.
// Most accept an `index` argument to track that they are executed in order,
// and set a color to visualize the change and order.

const setColor = (color, index) => {
    console.log("Setting", color, index)
    area.style.backgroundColor = color;
};


// Step that does one thing.
const simpleStep = step(setColor, stepOptions);
// const simpleStep = step(setColor);


// Step which is made up of other steps.
const compositeStep = step(
    async (index) => {
        await simpleStep("blue", index);
        await simpleStep("yellow", index);
    },
    stepOptions
);


// Step which returns a value asynchronously. 
const returningStep = step(
    async (index) => {
        await sleep(500);
        setColor("brown", index);
        return [Math.random(), index];
    },
    stepOptions
)


// Assemble our steps into a sequence.
// This could in theory be a step in itself.
const performSteps = async (index) => {
    await simpleStep("red", index);
    await simpleStep("green", index);
    await compositeStep(index);
    console.log("Returned", await returningStep(index));
};


/* UI and setup */

let pauseButton;
let playButton;
let ffwdButton;
let unpausedAction = "play";
let area;


/** Enter the paused state and update the UI. */
const pause = () => {
    paused = true;
    
    // Remember which speed was used.
    unpausedAction = playButton.disabled ? "play" : "ffwd";

    pauseButton.disabled = true;    
    playButton.disabled = false;
    ffwdButton.disabled = false;
}


/** Cancel the paused state, set the play speed, and update the UI. */
const play = () => {
    paused = false;
    delayTime = NORMAL_DELAY_TIME;
    pauseButton.disabled = false;
    playButton.disabled = true;
    ffwdButton.disabled = false;
}


/** Cancel the paused state, set the ffwd speed, and update the UI. */
const ffwd = () => {
    paused = false;
    delayTime = SHORT_DELAY_TIME;
    pauseButton.disabled = false;
    playButton.disabled = false;
    ffwdButton.disabled = true;
}


/** Enter the paused state if not in it, or return to the previous speed. */
const togglePause = () => {
    if (!paused) {
        pause();
        return;
    }

    if (unpausedAction === "play") {
        play();
    } else {
        ffwd(); 
    }
}


window.addEventListener("load", async () => {
    // UI and event listeners
    area = document.getElementById("area");
    pauseButton = document.getElementById("pause");
    playButton = document.getElementById("play");
    ffwdButton = document.getElementById("ffwd");
    
    pauseButton.addEventListener('click', pause, false);
    playButton.addEventListener('click', play, false);
    ffwdButton.addEventListener('click', ffwd, false);

    area.addEventListener("click", togglePause, false);
    window.addEventListener("keyup", (e) => {
        if (e.keyCode === 32) {  // Spacebar
            togglePause();
        }
    }, false)

    // Execute our steps several times, akin to a game loop.
    // Limit the number of executions in case we make some mistakes.
    // Pass the current `i` to verify that we are executing steps in order.
    for (let i = 0; i < 100; i++) {
        await performSteps(i);
    }
}, false);

