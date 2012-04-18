var FSM = function(colorsArray) {//colorsArray keeps the colors of the clues (non repetitive)
	var i, transitions = new Array;
    // transitions is a 2D array. First dimension is input (eg: 0 or 1). Second dimension is 
    // ID number of current state (eg: 0, 1, 2...). The value is the output state (notice the output
    // is a new state by itself, not ID number. If queries two times, the array gives two new different
    // states with same ID number, NOT one same state like the old version which caused much reference error.
    for (i = 0; i < colorsArray.length; i++) {
        transitions[colorsArray[i]] = [];
    }
    
    this.initState;
    
    this.currentState;
    
    this.finalState;
    
    // define a new transition for currentState after taking an input. The resulting state is outputState
    this.addTransition = function(currentState, input, outputState) {
        if(!transitions[input]) transitions[input] = []; //ensure we have an array.
        transitions[input][currentState.number] = outputState;
    }
    
    // querry the currentState using its already defined transition
    // Notice here we return a copy of the output state. This is for external use (outside the FSM) because
    // external code would identify state by its ID only and refer to FSM for the transitions from the state.
    // Internally, we still store currentState as the original output state. Actually not necessary because
    // transitions array only use state number to index, not the state itself
    this.addInput = function(currentState, input) {
        var result;
        if(!transitions[input]) transitions[input] = []; //ensure we have an array.
        result = transitions[input][currentState.number];
        if (result) {this.currentState = result; return result.copy();}
        // defensively, if there is no transition, it will return undefined
        return result;
    }
    
    this.accepts = function(inputarray){
        this.currentState = this.initState;
   
        for(var i = 0; i < inputarray.length && this.currentState && !this.currentState.isFailState; i++){
            this.addInput(this.currentState, inputarray[i]);
            
        }
      
        return (this.currentState && this.currentState.isFinalState);
    };
};

//A State doesn't remember the transition function. Transitions are store in FSM's transitions array
var FSMState = function() {
    this.number = FSMState.count++;
    
    //FSMState must have the copy function. This returns a new state with the same attributes except isDeleted
    this.copy = function() {
        var result = new FSMState();
        //copy 3 characteristics. Do not copy the isDeleted value.
        result.number = this.number;
        result.isFinalState = this.isFinalState;
        result.isFailState = this.isFailState;
        return result;
    }
    
    // states are identified by their number. ? Should we error check by verifying that isFinalState and isFailState??
    this.isEqual = function(state) {
        return (state.number && state.isFinalState && state.isFailState && (state.number === this.number) && (state.isFinalState === this.isFinalState) && (state.isFailState === this.isFailState));
    }
    
    //The default value is false
    // isFinal meaning the state is the end State of a legal input sequences
    this.isFinalState = false;
    // isFailState meaning the state resulted from inputing an illegal sequences
    this.isFailState = false;
    // isDeleted meaning the state was erased by external code (the nonogram code)
    this.isDeleted = false;

    
};

// count is used to generate ID number for states. Is there anyway to avoid global variable?
FSMState.count = 0;

// Problem: There is no way to tell if two states are the same!!! 

var createAutomaton = function(cluearray, colorsOfClues, colorsArray) {//colors in colorsOfClues must not be 0 (white)
   //clueArray Eg: [2,3]
  //colorsOfClues corresponds to colors of clues in cluearray. Eg:[1,1]
  //colorsArray keeps the colors used in the clues (non repetitive) Eg:[0,1]
  var white = 0;
  
  //failState has number = 0
  failState = new FSMState();
  failState.isFailState = true;
  
  //initState has number = 1
  result = new FSM(colorsArray);
  currentState = new FSMState();
  result.initState = currentState;
  
  for (var i = 0; i < cluearray.length; i++) {
      var thisColor = colorsOfClues[i];
      
      //the first state points to itself if receives a white
      result.addTransition(currentState, white, currentState);
      var newState = new FSMState();
      //newState is the first state that accepts the color of clue
      //newState fails if given other inputs
      for(var k = 1; k < colorsArray.length; k++){
        
          result.addTransition(currentState, colorsArray[k], (colorsArray[k] == thisColor) ? newState : failState);
      }
      currentState = newState;
      
      //creates another n-1 states that accept this color. these will point to failState if any other colors is given to them
        for (var j = 0; j < cluearray[i] - 1; j++) {
            newState = new FSMState();
            for(var k = 0; k < colorsArray.length; k++){
                result.addTransition(currentState, colorsArray[k], (colorsArray[k] == thisColor) ? newState : failState);
              
            }
            currentState = newState;
        }
      
        //the last state points to a failstate if receives another (redundant) black
        //      result.addTransition(currentState, cluearray[i].getClueColor() - 1, failState); //? Not sure about this.
      
        if (i < cluearray.length - 1) {//if this not the last clue
            if (colorsOfClues[i+1] == colorsOfClues[i]){//if the next clue has the same color
                  //the last state points to a newState that doesn't accept black if given white
                newState = new FSMState();//transition state between two clues
                result.addTransition(currentState, white, newState);
               
                for(var k = 1; k < colorsArray.length; k++){//exclude color white
                    //Fail all non-whites.
                    result.addTransition(currentState, colorsArray[k], failState);
              
                }
               
                currentState = newState;
            } else {
                //if the color is different btw this clue and the next clue, no need for a white in between
                //do nothing!
                
                
            }
        } else {
            //if this is the last clue, the last state points to itself if received a white
            result.addTransition(currentState, white, currentState);
            for (var k = 1; k < colorsArray.length; k++){//exclude white
                //Fail all non-whites.
                result.addTransition(currentState, colorsArray[k], failState);
              
            }
                
        }
    }
  

  currentState.isFinalState = true;
  result.finalState = currentState;
  
  return result;
};

