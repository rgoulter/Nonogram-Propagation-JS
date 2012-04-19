/*

Copyright (c) 2012, Richard Goulter <richard.goulter@gmail.com> and Ngo Thuy Hang <hangjoni@gmail.com>
Distributed under the Modified BSD Licence. (http://opensource.org/licenses/BSD-3-Clause).

This NonogramSolver builds upon FD.js by Srikumar K. S. <srikumarks@gmail.com>,
which can be found on GitHub at https://github.com/srikumarks/FD.js.

The algorithm behind the solver makes use of a regular constraint as described
in the paper "Regular Language Membership Constraint" by Niko Paltzer.
http://www.ps.uni-saarland.de/courses/seminar-ws04/papers/paltzer.pdf

*/

//initial can be number or array
    Array.matrix = function(m, n, initial) {
        var a, i, j, mat = [];
        var isObject = (typeof(initial) === 'object');
        for (i = 0; i < m; i++) {
            a = [];
            for (j = 0; j < n; j++) {
                a[j] = isObject ? initial.slice() : initial;
            }
            mat[i] = a;
        }
        return mat;
    };
    
     //initial can be number or array
    Array.dim = function(size, initial) {
        var i, a = [];
        var isObject = (typeof(initial) === 'object');
        for (i = 0; i < size; i++) {
            a[i] = isObject ? initial.slice() : initial;
        }
        return a;
    };
    
    
    Array.prototype.contains = function (x) {
        var i;
        for (i = 0; i < this.length; i++) {
            if (this[i] === x) {return true;}
        }
        return false;
    };
    
    //returns the first value a in array that f(a) = true. Else, return false
    Array.prototype.fcontains = function (f) {
        var i;
        for (i = 0; i < this.length; i++) {
            if (f(this[i])) {return this[i];}
        }
        return false;
    };
    
    //modifies array, only retain those value x that satisfies f(x) == true
    Array.prototype.filter = function(f) {
        var i;
        
        i = 0;
       
        while (i < this.length) {
            if (!f(this[i])) {
                this.splice(i,1);
            } else {
                i++;
            }
        }
        return this;
    };
    
    //return the merged array of arrays. Eg: [[0,3], [5,6]] => [0,1,2,3,5,6]
    Array.prototype.inMerge = function() {
        var i, j, result = [];
        for (i = 0; i < this.length; i++) {
            var start = this[i][0];
            var end = this[i][1];
            while (start <= end) {
                result.push(start);
                start = start + 1;
            }
            
        }
        return result;
    };
    
	
	
	
    
    //return the result of mapping function f on every members of the array
    Array.prototype.map = function(f) {
        var i, result = [];
        for (i = 0; i < this.length; i++) {
            result.push(f(this[i]));
        }
        return result;
    };
    
    //sum over all members of the array
    Array.prototype.sum = function() {
        var i, result = 0;
        for (i = 0; i < this.length; i++) {
            result += this[i];
        }
        return result;
    };
	
//Nonogram propagator
//FD has "space" property, not "Space"
FD.space.prototype.np = function (var_names, clueArray, colorsOfClues, colorsArray) {
    //var_name is the array of variable names, exp: ["x1", "x2", "x3"]
    //variables should have already been declared with domains in the main program
    
    //clueArray is the count in clues
    //colorsOfClues keeps the corresponding color values for clues in clueArray
    
    //colorsArray keeps the colors used for clues (non repetitive)
    
    var maxColor = colorsArray.sort()[colorsArray.length - 1];
    
    
	var p = {
	allvars: var_names,
	depvars: var_names,
	step: function() {
		
		var var_array = this.space.slice(1, this.space.length);
        domarray = var_array.map(function(var1) {return var1.dom;});
        
		
		//n is the number of variables in a constraint
		var n = var_names.length;
		var nextStep = var_array.map(function(vi) {return vi.step;}).sum();
		if (nextStep > this.last_step) {
			var i,j,k;      
			
			//N stores the states associating with a variable in the graph
			// N[i] stores the states at variable i, after taking in inputs i from 1 to n
			// N[i-1] stores the states at variable i, before taking in inputs
			var N = Array.dim(n + 1, []);
			//Q stores the states at variable i that was the result of inputting a certain color
			var Q = Array.matrix(n, maxColor + 1, []);
							
			theFSM = createAutomaton(clueArray, colorsOfClues, colorsArray);
			
			// N[0] stores the initial state of theFSM. It is the prior state for variable 1
			N[0] = [theFSM.initState];
		
			
			/*
            *Forward 
            */
			for (i = 0; i < n; i++) {
				
				var dom = var_array[i].dom.inMerge(); //Eg: [0,1]
                
                
				for (k = 0; k < N[i].length; k++) {
				   
					var qk = N[i][k];
					for (j = 0; j < dom.length; j++) {
						
						
						var qm = theFSM.addInput(qk, dom[j]);
						// what if qm is failstate? It's still added to Q? It shouldn't be
			   
						if (qm && !qm.isFailState) {
						 
							//remember this state of variable i can take input dom[j]
							Q[i][dom[j]].push(qk);
							
							
							// check if qm is already one of the states in the next variable
							var q_temp = N[i + 1].fcontains(function(state) {return (state.number === qm.number);});
	
							
							// if not, add it to the next variable's possible inputs states array
							if (!q_temp) {
								
								N[i + 1].push(qm);
							} else {
								// if qm is indeed added, use that state as the reference for links, not qm
								
								qm = q_temp;
							}
							
							// creating backward link for qm
							(qm.prev) ? qm.prev.push(qk) : (qm.prev = [qk]);
							
							// creating forward link for qk
							(qk.next) ? qk.next.push(qm) : (qk.next = [qm]); 
							
						}
						
					}
				}
			}
			
			
            /*
			*Backward: Delete states in the last variable that aren't final states
			*/
            for (i = 0; i < N[n].length; i++) {
				var state = N[n][i];
				if (!state.isFinalState) {
					state.isDeleted = true;
				}
			}
		   
			
			//update N[n]
			
			N[n].filter(function (state) {return !state.isDeleted;});
			
		  
			//if a State has no outward link, remove it
			for (i = n - 1; i >= 0; i--) { 
		
				for (j = 0; j < N[i].length; j++) {
				  
					var aState = N[i][j];
					
					// Filter out deleted states from the stored next attribute of the state
					
					// Bug if aState.next is undefined. For example where the clue array is empty. Simple fix:
					// If there is no clue requirement, the state should be reached
					if (!aState.next) {aState.isDeleted = true; continue;}
					aState.next.filter(function (state) {return !state.isDeleted;});
					// If there are no states remaining in next, aState has no outward link
					if (aState.next.length === 0) {aState.isDeleted = true;}
					
				}

			}
			
			//if a State has no inward link, remove it
			for (i = 1; i <= n; i++) { 
				
				for (j = 0; j < N[i].length; j++) {
				  
					var aState = N[i][j];
					// Filter out deleted states from the stored prev attribute of the state
					aState.prev.filter(function (state) {return !state.isDeleted;});
				   // If there are no states remaining in prev, aState has no inward link
					if (aState.prev.length === 0) {aState.isDeleted = true;}
				}
			}
			
			
			
			//update N[i]
			for (i = 0; i <=n; i++) {
				
				N[i].filter(function (state) {return !state.isDeleted;});
			
			}
			
			//Consider if each variable support each of the value in its domain
			//If it doesn't, remove that value from the domain of the variable
			for (i = 0; i < n; i++) {
				var the_dom = var_array[i].dom;
				var dom = the_dom.inMerge(); //Eg: [0,1]
				
				for (j = 0; j < dom.length; j++) {
					
					// N[i] stores the previous states of variable i (counting from 0)
					// var temp = N[i]["accept" + dom[j]]
					// temp is the result of asking all states in N[i] (prev states of variable i) to
					// take in input dom[j]
					
					// For filtering purpose, it is ok to ask FSM directly for the output state
					
					
					//filter out the deleted states and fail states from temp
					//the states in temp must appear in N[i+1] since we ask FSM directly, isDeleted would always be false.
					// should use Q here
					// temp.filter(function (state) {return (state && !state.isDeleted && !state.isFailState)});
					
					
					// filter Q for the states that can take the input dom[j] and haven't been deleted
					// further filter for the states returns a state contained in N[i+1] once it took the dom[j] input 
					
                    var temp = Q[i][dom[j]].filter(function(state) {return !state.isDeleted;});
					temp.filter(function(state) {return N[i+1].fcontains(function(state2) {return state2.number === theFSM.addInput(state,dom[j]).number;});});
					
					
					//if temp is empty, remove dom[j] from domain
					if (temp.length === 0) {
					    
						for (k = 0; k < the_dom.length; k++) {
							// for each interval k of the_dom, check if dom[j] is in the range of the_dom[k]
							if ((the_dom[k][0] <= dom[j]) && (the_dom[k][1] >= dom[j])) {
                               
                                var new_dom =[];
                                
                                // split interval k into two halves, eliminating dom[j]
								var sub2 = [], sub3 = [];
								if (the_dom[k][0] < dom[j]) {
									sub2 = [the_dom[k][0],dom[j] - 1];
								}
								
								if (the_dom[k][1] > dom[j]) {
									sub3 = [dom[j] + 1, the_dom[k][1]];
								}
                                
                                //putting items into new_dom
                                for (var count= 0; count< k; count++) {
                                    new_dom.push(the_dom[count]);//items before the split interval
                                    
                                }
                                if (sub2.length > 0) {
                                    new_dom.push(sub2);
                                }
                                if (sub3.length > 0) {
                                    new_dom.push(sub3);
                                }
								for (var count= k+1; count< the_dom.length; count++) {
                                    new_dom.push(the_dom[count]);//items after the split interval
                                    
                                }
                                //reset the_dom 
                                the_dom = new_dom;
                                break;
							}
						}
                        
					}
				}
			 
				var_array[i].set_dom(the_dom);
			}
			this.last_step = var_array.map(function(vi) {return vi.step;}).sum();
			return this.last_step - nextStep;
		} else {
			return 0;
		}
		
	
	}
	
};
return this.newprop(p);  


};
