/*

Copyright (c) 2012, Richard Goulter <richard.goulter@gmail.com> and Ngo Thuy Hang <hangjoni@gmail.com>
Distributed under the Modified BSD Licence. (http://opensource.org/licenses/BSD-3-Clause).

This NonogramSolver builds upon FD.js by Srikumar K. S. <srikumarks@gmail.com>,
which can be found on GitHub at https://github.com/srikumarks/FD.js.

The algorithm behind the solver makes use of a regular constraint as described
in the paper "Regular Language Membership Constraint" by Niko Paltzer.
http://www.ps.uni-saarland.de/courses/seminar-ws04/papers/paltzer.pdf

*/

function UISolver(nono) {
    //transforming nono object into the required inputs for solver
    var rowClues, colClues, rowColors, colColors,colorsArray,dom;
    
    var row, col, rowtemp, coltemp;
    var i, j, name, namer, namec;

    // getting size of the nonogram from the nono object, passed in by UI
    row = nono.getHeight();
    col = nono.getWidth();
    // store here the row clues and col clues. Format of rowtemp: [[row1clue1,
    // row1clue2],[row2clue1, row2clue2]]
    rowtemp = nono.getClues().row;
    coltemp = nono.getClues().col;
    
    //getting the clues for rows
    rowClues = [];
    rowColors = [];
    
    for (var i = 0; i < rowtemp.length; i++) {
        var thisrow = rowtemp[i];
        var r = thisrow.map(function (obj) {return obj.getClueCount();});
        var cl = thisrow.map(function (obj) {return obj.getClueColor();});
        rowClues.push(r);
        rowColors.push(cl);
    }
    
    //getting the clues for cols
    colClues = [];
    colColors = [];
    
    for (var i = 0; i < coltemp.length; i++) {
        var thiscol = coltemp[i];
        var r = thiscol.map(function (obj) {return obj.getClueCount();});
        var cl = thiscol.map(function (obj) {return obj.getClueColor();}); // -1 here, because of the color disparity between UI and solver.
        colClues.push(r);
        colColors.push(cl);
    }
    
    //getting the colors for this nonogram
    //also finding the dom
    colorsArray = [];
    dom = [];
    var start = 0;
    var end = 0;
    var isDiscontinued = false;
    
    colorsArray.push(0); //white space is always used
    for (var i = 0; i <= nono.getPalette().getSize(); i++) {//check all the colors on the Palette if it was used
        var isUsed = false;

//        for (var j = 0; j < colColors.length; j++) {
//            if(colColors[j].contains(i)){
//                isUsed = true;
//                break;
//            }
//        }
        isUsed = colColors.map(function(clueRow){ return clueRow.contains(i); }).contains(true) ||
                 rowColors.map(function(clueRow){ return clueRow.contains(i); }).contains(true);
        
        if (isUsed === true) {
            colorsArray.push(i);
            if (isDiscontinued === false) {
                end = i;
            } else {
                isDiscontinued = false;
                dom.push([start, end]);//push in the old interval everytime we open a new interval
                start = i;
                end = i;
            }
        } else {
            isDiscontinued = true;
        }
    }
    dom.push([start, end]);//push in the last interval
    //
    console.log("rowClues " + JSON.stringify(rowClues));
    console.log(" rowColors" + JSON.stringify(rowColors));
    console.log(" colClues " + JSON.stringify(colClues));
    console.log("colColors " + JSON.stringify(colColors));
    console.log("colorsArray " + JSON.stringify(colorsArray));
    console.log("dom " + JSON.stringify(dom));
    return solver(rowClues,rowColors,colClues,colColors,colorsArray, dom);
}
function solver(rowClues, rowColors, colClues, colColors, colorsArray, dom) {
    var S, space, curSpace, newSpace;
    var i, j;
    var spaceStack = [];
    var solvedStack = [];
    var solutionsStack = [];
    var varName;
    var arr;

    // Add constraints from nono into S
    S = input(rowClues, rowColors, colClues, colColors, colorsArray, dom, new FD.space());

    // Branching from S to get all possible solutions for this nonogram
    S.propagate();
    spaceStack.push(S);

    while (spaceStack.length != 0) {// while there are still space to explore
        curSpace = spaceStack.pop();
        if (curSpace.is_solved()) {
            solvedStack.push(curSpace);
        } else { // naive branching - YikJiun's code

            varName = firstNonConstVar(curSpace);

            if (varName !== "") {
                for (i = curSpace.vars[varName].min(); i <= curSpace.vars[varName].max(); i++) {
                    try {
                        newSpace = curSpace.clone();
                        newSpace.eq(varName, newSpace.const(i));
                        newSpace.propagate();
                        if (newSpace.is_solved()) {
                            solvedStack.push(newSpace);

                        } else {
                            spaceStack.push(newSpace);
                        }

                    } catch (e) {
                        
                    }
                }
            } else { // Do nothing
                
            }
        }
    }

    // Keep the set of solutions in an array to feed to the UI
    while (solvedStack.length > 0) {
        space = solvedStack.pop();
        arr = output(rowClues, colClues, space);
        solutionsStack.push(arr);
    }

    return solutionsStack;

}

// YikJiun's code
function firstNonConstVar(Space) {
    for ( var varName in Space.vars) {
        if (Space.vars[varName].size() !== 1) {
            return varName;
        }
    }
    return "";// space is either solved or stable
}

// Input from UI to solver
function input(rowClues, rowColors, colClues, colColors, colorsArray, dom, S) {
    var row, col, rowtemp, coltemp;
    var i, j, name, namer, namec;

    // getting size of the nonogram from the nono object, passed in by UI
    row = rowClues.length;
    col = colClues.length;
    
    
    //dom = [[0,1],[3,3],[5,5]];
    //
    
    // Declaring variables
    for (i = 0; i < row; i++) {
        for (j = 0; j < col; j++) {
            name = "r" + i + "c" + j;
            S.decl(name, dom);
        }
    }

    // Declaring the constraints from each row clues in the space
    for (i = 0; i < row; i++) {
        namer = Array.dim(col, "r" + i);
        for (j = 0; j < col; j++) {
            namer[j] = namer[j] + "c" + j;
        }
        console.log("Row constraints "+i);
        
        if (rowClues[i].length > 0) {//if this is not a blank row
            S.np(namer, rowClues[i], rowColors[i], colorsArray);
        } else {//if this is a blank row, set all cells to white
            for (var count = 0; count < row; count++) {
                S.eq(namer[count],S.const(0));
            }
        }
    }

    // Specifying the constraints from each col clues in the space
    for (j = 0; j < col; j++) {
        namec = Array.dim(row, "c" + j);
        for (i = 0; i < row; i++) {
            namec[i] = "r" + i + namec[i];
        }
        console.log("Col constraints "+j);
        if (colClues[j].length > 0) {
            S.np(namec, colClues[j], colColors[j], colorsArray);
        } else {
            for (var count = 0; count < col; count++) {
                S.eq(namec[count],S.const(0));
            }
        }
    }

    S.propagate();
    '' + S;
    return S;

}

//Output from Solver to UI: cell values
function output(rowclue, colclue, S) {

	var row, col, a, name, i, j;
	row = rowclue.length;
	col = colclue.length;
	
	if (!S.is_solved()) {throw "Found an unsolved space in solvedStack!";} //should not happen
	
	a = Array.matrix(row, col, 0);
	
	//Copy the solved value in variable dom into matrix
	for (i = 0; i < row; i++) {
		for (j = 0; j < col; j++) {
			name = "r"+i+"c"+j;
			a[i][j] = S.vars[name].dom[0][0];
			
		}
	}
	
	return a;
	
}