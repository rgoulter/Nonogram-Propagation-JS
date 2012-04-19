/*

Copyright (c) 2012, Richard Goulter <richard.goulter@gmail.com> and Ngo Thuy Hang <hangjoni@gmail.com>
Distributed under the Modified BSD Licence. (http://opensource.org/licenses/BSD-3-Clause).

This NonogramSolver builds upon FD.js by Srikumar K. S. <srikumarks@gmail.com>,
which can be found on GitHub at https://github.com/srikumarks/FD.js.

The algorithm behind the solver makes use of a regular constraint as described
in the paper "Regular Language Membership Constraint" by Niko Paltzer.
http://www.ps.uni-saarland.de/courses/seminar-ws04/papers/paltzer.pdf

*/

/**
    NOTE ON TERMINOLOGY:
    - "row" refers to a sequence of cells in either a row or a column of
      the nonogram puzzle.
    - "clue" refers to an individual clue value (its color, and stretch length).
      "clues" and "clueset" refers to the set of all clues (for both the rows
      and the columns).

    NOTE ON STRUCTURES:
    - data for a Nonogram object/puzzle is an array of arrays of numbers.
      each number ought to correspond to a color value/index of the
      color palette of the puzzle.
      Unknown = 0, Blank = 1.
    - a ColorPalette is a list of (indexable) colors, used for the
      Nonogram puzzle, and clues. 'color' generally refers to a Color
      data type, accessible by makeColor
    - a ClueRowUI manages a row of clues. A clue is represented by
      a data structure accessible by the makeClue(color,count), getCount(clue),
      and getColor(clue).
 */

var simple_checkerboard = [[1,0,1,0,1,0,1,0],
                           [0,1,0,1,0,1,0,1],
                           [1,0,1,0,1,0,1,0],
                           [0,1,0,1,0,1,0,1],
                           [1,0,1,0,1,0,1,0],
                           [0,1,0,1,0,1,0,1],
                           [1,0,1,0,1,0,1,0],
                           [0,1,0,1,0,1,0,1]];

///////////////////////////////////////////////////////////////////////////////
//Methods for tracking whether the mouse is down.
///////////////////////////////////////////////////////////////////////////////
var mouseDown = 0;
function updateMouseState(){
  var txt = document.getElementById("mouse_state_textbox");
  if(txt){
      txt.value = ((mouseDown == 0) ? "Up" : "Down") + " (" + mouseDown + ").";
  }
};
document.body.addEventListener("mousedown",  function(){ ++mouseDown; updateMouseState(); /*return false;*/ } , true);
document.body.addEventListener("mouseup",  function(){ mouseDown = Math.max(0, mouseDown - 1); updateMouseState(); /*return false;*/ } , true);
document.body.onmouseout = function(){
  e = event.toElement || event.relatedTarget;
  if (!e || !(e.id.search("nonogram") == 0)) {
      // If we're leaving the nonogram puzzle.
      mouseDown = 0;
      return;
  }
};

var NonogramConstants = {

};

/**
 * Finds the position of a DOM element on the HTML page.
 * Data is returned in [left, top] format.
 */
var findPosition = function (obj) {
    var curleft = 0, curtop = 0;
    if (obj.offsetParent) {
        do {
            curleft += obj.offsetLeft;
            curtop += obj.offsetTop;
            if(obj.offsetParent){
                curleft -= obj.scrollLeft;
                curtop -= obj.scrollTop;
            }
        } while (obj = obj.offsetParent);
    }
    return [curleft,curtop];
};




var Nonogram = function (tblID, width, height, palette) {
    //Constants
    Nonogram.CELLS_PER_GRID = 5; //TODO: Allow this to be set.
    var ROW = ClueRowUI.TYPE_ROW; //For shorthand reference.
    var COL = ClueRowUI.TYPE_COL;
    
    var PLAY_STATE = "play"; //For user-playing
    var EDIT_STATE = "edit"; //For user-editing of clues
    var DRAW_STATE = "draw"; //For user-drawn images
    var VALID_STATES = [PLAY_STATE, EDIT_STATE, DRAW_STATE];

    var that = this; //Self-reference
    
    this.data = null;
    var editable = false;
    var currentState = PLAY_STATE;

    var rowClues = [];
    var colClues = [];
    var clueUIs = {};
    clueUIs[ROW] = rowClues;
    clueUIs[COL] = colClues;

    var moveStack = []; //for history of moves.
    var searchStack = []; //for history of moves.

    var initDragCell = {};
    var lastDragCell = {};

    
    
    ///////////////////////////////////////////////////////////////////////////
    // Writing/HTML methods
    ///////////////////////////////////////////////////////////////////////////


    //Write div + table to document.
    var writePuzzle = function() {
        document.writeln("<div id=\"" + tblID + "_div\">");
        document.writeln(that.getHTML());
        document.writeln("</div>");

        that.refresh();
    };
    
    
    
    var createPuzzleElement = function(){
        var puzzleElement = document.createElement("div");
        puzzleElement.id = tblID + "_div";

//        puzzleElement.style.minWidth = "400px";
//        puzzleElement.style.minHeight = "400px";
        
        var tblElement = makeTableElement();
        puzzleElement.appendChild(tblElement);
        
        that.refresh();
        return puzzleElement;
    };
    
    
    
    var appendPuzzleToElement = function(el){
        var puzzleElement = createPuzzleElement();
        el.appendChild(puzzleElement);
        return puzzleElement;
    };



    var refresh = function(){
        var div = document.getElementById(tblID + "_div");
        if(!div){ return; }
        div.innerHTML = that.getHTML(); //NO.

        //Link cells to the callback function.
        for(var row = 0; row < height; row++){
            for(var col = 0; col < width; col++){
                var cell = document.getElementById(makeCellID(row, col));

                cell.onmousedown = (function(r, c){
                    return function(){
                        if(searchStack.length > 0){ return; }
                        initDragCell.row = r; //Reset initial drag cell
                        initDragCell.col = c;
                        lastDragCell.row = undefined; //Reset last drag cell
                        lastDragCell.col = undefined;
                        that.setCellData(r, c, that.getPalette().getCurrentIndex());
                        return false;
                    }; })(row, col);

                cell.onmouseover = (function(r, c){
                    return function(event){
                        if(mouseDown && searchStack.length === 0){
                            if(lastDragCell.row === undefined){
                                lastDragCell.row = r;
                                lastDragCell.col = c;
                            }
                            
                            if(!event.shiftKey){
                                that.setCellData(r, c, that.getPalette().getCurrentIndex());
                            } else {
                                //Draw a line.
                                if(initDragCell.row === lastDragCell.row){ //Horizontal
                                    that.setCellData(initDragCell.row, c, that.getPalette().getCurrentIndex());
                                } else {
                                    that.setCellData(r, initDragCell.col, that.getPalette().getCurrentIndex());
                                }
                            }
                        }
                    }; })(row, col);
            }
        }

        for(var clueType in clueUIs){
            if(clueUIs.hasOwnProperty(clueType)){
                for(var i = 0; i < clueUIs[clueType].length; i++){
                    var cEd = clueUIs[clueType][i];
                    cEd.setPalette(palette);
                    cEd.setEditable(editable);
                    cEd.refresh();
                }
            }
        }
    };
    


    var getHTML = function() {
        var htmlStr = "";
        htmlStr += "<table id=\"" + tblID + "\" class=\"unselectable\" cellspacing=\"0\" >";

        //First Row.
        htmlStr += "<tr id=\"" + tblID + "_gridrow0\"><td class=\"nonogram\" align=\"center\">&nbsp;</td>";
        for(var i = 0; i < width; i += Nonogram.CELLS_PER_GRID){
            htmlStr += getClueCellHTML(COL, i, Math.min(i + Nonogram.CELLS_PER_GRID, width));
        }
        htmlStr += "</tr>";

        //Remaining Rows.
        for(var row = 0; row < height; row += Nonogram.CELLS_PER_GRID){
            htmlStr += "<tr id=\"" + tblID + "_gridrow" + (row / Nonogram.CELLS_PER_GRID + 1) + "\">";

            //Clue
            var rowTo = Math.min(row + Nonogram.CELLS_PER_GRID, height);
            htmlStr += getClueCellHTML(ROW, row, rowTo);

            //cell grids
            for(var col = 0; col < width; col += Nonogram.CELLS_PER_GRID){
                var colTo = Math.min(col + Nonogram.CELLS_PER_GRID, width);
                htmlStr += getGridCellHTML(row, rowTo, col, colTo);
            }

            htmlStr += "</tr>";
        }

        htmlStr += "</table>";
        return htmlStr;
    };
    


    var makeTableElement = function() {
        var tblElem = document.createElement("table");
        tblElem.id = tblID;
        tblElem.className = "unselectable";
        tblElem.cellspacing = 0;
        
        //First Row.
        var trElem = document.createElement("tr");
        trElem.id = tblID + "_gridrow0";
        trElem.appendChild(document.createElement("td"));
        for(var i = 0; i < width; i += Nonogram.CELLS_PER_GRID){
            trElem.appendChild(makeClueCellElement(COL, i, Math.min(i + Nonogram.CELLS_PER_GRID, width)));
        }
        tblElem.appendChild(trElem);

        //Remaining Rows.
        for(var row = 0; row < height; row += Nonogram.CELLS_PER_GRID){
            trElem = document.createElement("tr");
            trElem.id = tblID + "_gridrow" + (row / Nonogram.CELLS_PER_GRID + 1);

            //Clue
            var rowTo = Math.min(row + Nonogram.CELLS_PER_GRID, height);
            trElem.appendChild(makeClueCellElement(ROW, row, rowTo));

            //cell grids
            for(var col = 0; col < width; col += Nonogram.CELLS_PER_GRID){
                var colTo = Math.min(col + Nonogram.CELLS_PER_GRID, width);
                trElem.appendChild(makeGridCellElement(row, rowTo, col, colTo));
            }
            
            tblElem.appendChild(trElem);
        }
        
        return tblElem;
    };
    


    var getClueCellHTML = function(type, from, to){
        var htmlStr = "";
        htmlStr += "<td class=\"nonogram\" align=\"right\" valign=\"bottom\">";

        htmlStr += "<table id=\"" + tblID + "_" + type + "cluecell_" +
        (from/Nonogram.CELLS_PER_GRID) + "\" cellspacing=\"0\">";

        if(type === COL){
            htmlStr += "<tr>";
        }

        for(var i = from; i < to; i++){
            var clueUI = getClueUI(type, i);

            if(type === ROW){
                htmlStr += "<tr>";
            }
            htmlStr += "<td align=\"right\" valign=\"bottom\">";

            htmlStr += "<div id=\"" + clueUI.getID() + "_div\">";
            htmlStr += clueUI.getHTML();
            htmlStr += "</div>";

            htmlStr += "</td>";
            if(type === ROW){
                htmlStr += "</tr>";
            }
        }

        if(type === COL){
            htmlStr += "</tr>";
        }
        htmlStr += "</table>";

        htmlStr +="</td>";
        return htmlStr;
    };
    
    
    
    var makeClueCellElement = function(type, from, to){
        var tdElem = document.createElement("td");
        tdElem.className = "nonogram";
        tdElem.align = "right";
        tdElem.valign = "bottom";

        var tblElem = document.createElement("table");
        tblElem.id = tblID + "_" + type + "cluecell_" +
            (from/Nonogram.CELLS_PER_GRID);
        tblElem.cellspacing = 0;

        var trElem = document.createElement("tr");
        tblElem.appendChild(trElem);
        
        if(type === COL){
            tblElem.appendChild(trElem);
        }
        
        for(var i = from; i < to; i++){
            var clueUI = getClueUI(type, i);

            var innerTdElem = document.createElement("td");
            innerTdElem.align="right";
            innerTdElem.valign = "bottom";
            trElem.appendChild(innerTdElem);

            var divElem = document.createElement("div");
            divElem.id = clueUI.getID() + "_div";
            divElem.innerHTML = clueUI.getHTML(); //TODO: append to element.
            innerTdElem.appendChild(divElem);

            if(type === ROW){
                tblElem.appendChild(trElem);
                trElem = document.createElement("tr");
            }
        }
        
        tdElem.appendChild(tblElem);

        return tdElem;
    };



    var getGridCellHTML = function(rowFrom, rowTo, colFrom, colTo){
        var htmlStr = "";
        htmlStr += "<td class=\"nonogram\" id=\"" + tblID + "_gridcell_" +
        (rowFrom/Nonogram.CELLS_PER_GRID) + "_" + (colFrom/Nonogram.CELLS_PER_GRID) + "\">";

        for(var row = rowFrom; row < rowTo; row++){
            for(var col = colFrom; col < colTo; col++){
                //Nonogram coloured cell.
                var cellID = makeCellID(row, col);
                htmlStr += "<svg version=\"1.1\" baseProfile=\"full\" xmlns=\"http://www.w3.org/2000/svg\" " +
                "class=\"square cell\" id=\"" + cellID + "\">";
                htmlStr += "<line id=\"" + cellID + "_line1\" x1=\"00\" x2=\"100%\" y1=\"0\" y2=\"100%\" stroke=\"grey\" stroke-width=\"1\" style=\"visibility: hidden;\"/>";
                htmlStr += "<line id=\"" + cellID + "_line2\" x1=\"00\" x2=\"100%\" y1=\"100%\" y2=\"0\" stroke=\"grey\" stroke-width=\"1\" style=\"visibility: hidden;\"/>";
                htmlStr += "</svg>";
            }
            htmlStr += "<br>";
        }

        htmlStr += "</td>";
        return htmlStr;
    };
    
    
    
    var makeGridCellElement = function(rowFrom, rowTo, colFrom, colTo){
        var tdElem = document.createElement("td");
        tdElem.id = tblID + "_gridcell_" + (rowFrom/Nonogram.CELLS_PER_GRID) +
            "_" + (colFrom/Nonogram.CELLS_PER_GRID);
//        tdElem.style.width = (5*15) + "px";
//        tdElem.style.height = (5*15) + "px";
        

        for(var row = rowFrom; row < rowTo; row++){
            for(var col = colFrom; col < colTo; col++){
                //Nonogram coloured cell.
                tdElem.appendChild(Nonogram.makeCellSVG(makeCellID(row, col)));
            }
            tdElem.appendChild(document.createElement("br"));
        }
        
        return tdElem;
    };



    ///////////////////////////////////////////////////////////////////////////
    // Cell color and data methods
    ///////////////////////////////////////////////////////////////////////////



    // Refers to the ID of the SVG Element in the DOM at (row, col).
    var makeCellID = function(row, col){
        return "" + tblID + "_cell_" + row + "_" + col;
    };


    
    var getCell = function(row, col){
        return document.getElementById(makeCellID(row,col));
    };



    //Cell data is not affected. Retrieve values needs to be called for that.
    var setCellStyleColor = function(row, col, styleColor){
        if(palette.getColorIndexByStyleColor(styleColor) < 0){
            throw "Error! \'" + styleColor + "\' is not a valid color in \'" + tblID + "\' nonogram.";
        };
        getCell(row, col).style.backgroundColor = styleColor;
    };



    var setCellColor = function(row, col, color){
        if(palette.getColorIndex(color) < 0){
            throw "Error! \'" + color + "\' is not a valid color in \'" + tblID + "\' nonogram.";
        };
        getCell(row, col).style.backgroundColor = color.getStyleColor();
    };
    


    var getCellStyleColor = function(row, col, styleColor){
        return getCell(row, col).style.backgroundColor;
    };
    


    var getCellColor = function(row, col, styleColor){
        return getCell(row, col).style.backgroundColor;
    };



    var setCellSpaceVisibility = function(row, col, visible){
        var str = visible ? "visible" : "hidden";
        document.getElementById(makeCellID(row, col) + '_line1').style.visibility = str;
        document.getElementById(makeCellID(row, col) + '_line2').style.visibility = str;
    };



    var setCellData = function(row, col, nVal){
        if(row >= height || col >= width){ //TODO: Color beyond proper value.
            throw "Error! (" + col + "," + row + ") is outside of the nonogram puzzle \'" + tblID + "\'";
        }

        if(searchStack.length == 0){
            //Only stack moves when we're not "searching" the history.
            stackMove(row, col, that.data[row][col], nVal);
        }
        that.data[row][col] = nVal;

        var cell = getCell(row, col);

        if(!cell){ return; };

        setCellSpaceVisibility(row, col, +nVal === 1);
        setCellColor(row, col, palette.getColor(+nVal));

        if(that.isDrawState()){ //Update clues from the data we have.
            var nClues = Nonogram.generateCluesFromSolution(that.data);
            that.setClues(nClues);
        }
        fireChange();
    };



    /**
     Resizes the nonogram. Cell data and clues are cleared,
     if the width or height are different to the present values.
     */
    var resizeTo = function(nWidth, nHeight){
        if(nWidth == width && nHeight == height){
            return true;
        }

        width = nWidth;
        height = nHeight;
        that.clearClues();
        that.clearCells();
        that.refresh();
    };



    /**
     Sets the internal representation of the Nonogram data,
     (nCellData), and displays these values to the output.
     If forceResize is true, then the table will be resized 
     */
    var setData = function(nCellData, forceResize){
        //Ensure the dimensions we are setting are appropriate.
        var dim = Nonogram.getDimensions(nCellData);
        if(dim.height !== height || dim.width !== width){
            if(forceResize){
                that.resizeTo(dim.width, dim.height);
            } else {
                throw "Error setting \'" + tblID + "\' nonogram data! Invalid dimensions. (" +
                        width + "x" + height + " !== " + dim.width + "x" + dim.height + ").";
            }
        }

        //So that setCellData() doesn't call fireChange() many times, preserve the value and call it later.
        var saved_fireChange = fireChange;
        fireChange = function(){ };

        that.data = nCellData.map(function(x){ return x.slice(0); });
        that.pushValues();

        clearMoveHistory();

        fireChange = saved_fireChange;
        fireChange();
    };



    var getData = function(){
        return that.data; //TODO: Copy data?
    };



    /**
     data -> DOM
     */
    var pushValues = function(){
        for(var row = 0; row < that.data.length; row++){
            for(var col = 0; col < that.data[row].length; col++){
                that.setCellData(row, col, that.data[row][col]);
            }
        }
    };



    /**
     DOM -> data
     */
    var fetchValues = function(){
        var result = [];

        for(var row = 0; row < height; row++){
            result[row] = [];
            for(var col = 0; col < width; col++){
                result[row][col] = palette.getColorIndexByStyleColor(that.getCellStyleColor(row,col));
            }
        }

        that.data = result;
    };



    ///////////////////////////////////////////////////////////////////////////
    // Clue methods
    ///////////////////////////////////////////////////////////////////////////



    var setPalette = function(nPalette){
        var UIs = palette.getDependentUIs();
        for(var i = 0; i < UIs.length; i++){
            palette.removeDependentUI(UIs[i]);
            UIs[i].setPalette(nPalette);
            nPalette.addDependentUI(UIs[i]);
        }
        palette = nPalette;
        palette.refresh();
    };



    var getPalette = function(){
        return palette;
    };



    var getClueUI = function(type, row){
        return (clueUIs[type][row] || (clueUIs[type][row] = new ClueRowUI(tblID, row, type)));
    };



    var setClues = function(nClueset){
        for(var type in nClueset){
            if(nClueset.hasOwnProperty(type)){
                for(var i = 0; i < nClueset[type].length; i++){
                    var ce = getClueUI(type, i);
                    ce.setClues(nClueset[type][i]);
                }

                clueUIs[type].splice(nClueset[type].length); //Get rid of extra clue UIs //?
            }
        }

        fireChange();
    };



    /**
     Returns in a clueset object {"row": rowclues, "col": colclues}, where
     the row and column clues are accessible by ClueRowUI.TYPE_ROW and .TYPE_COL
     values respectively.
     Representation of clues for each row/col. is described in ClueRowUI comments.
     */
    var getClues = function(){
        var result = {};
        for(var type in clueUIs){
            if(clueUIs.hasOwnProperty(type)){
                result[type] = [];

                for(var i = 0; i < clueUIs[type].length; i++){
                    result[type][i] = clueUIs[type][i].getClues();
                }
            }
        }
        return result;
    };
    
    
    
    ///////////////////////////////////////////////////////////////////////////
    // Methods for Move history.
    ///////////////////////////////////////////////////////////////////////////
    
    /*
     * When a 'move' (i.e. drawing in a cell) is made by Nonogram.setCellData(),
     * the move is added to the moveStack stack, recording location, what value it was
     * and what the new value is.
     * To scroll back through the 'history' of moves, we maintain a second stack,
     * the searchStack.
     * To restore the Nonogram UI to what it was before searching, call
     * endSearch(false). To "go back" to a move made in the history,
     * call endSearch(true).
     * 
     * While there are items in the search stack, no moves can be made. //TODO: Implement that.
     */

    //Records a move onto the move stack. (For History of moves).
    var stackMove = function(row, col, oldVal, newVal){
        moveStack.push({r: row, c: col, x: oldVal, y: newVal});
    };



    //Undoes a move.
    var restoreMove = function(){
        searchBack.call(that, 1);
        endSearch(true);
    };
    
    
    
    // moveStack -> searchStack by n moves.
    var searchBack = function(n){
        if(n === 0){ return; };
        if(n > moveStack.length){ throw "ERROR: Stack overflow exception."; }
        for(var i = 0; i < n; i++){
            var move = moveStack.pop();
            searchStack.push(move);
            that.setCellData(move.r, move.c, move.x);
        }
    };
    
    
    
    // moveStack <- searchStack by n moves.
    var searchForward = function(n){
        if(n === 0){ return; };
        if(n > searchStack.length){ throw "ERROR: Stack overflow exception."; }
        for(var i = 0; i < n; i++){
            var move = searchStack.pop();
            if(searchStack.length > 0){ moveStack.push(move); }
            that.setCellData(move.r, move.c, move.y);
        }
    };
    
    
    
    /**
     * 'Searches' through the move stack to a certain point.
     * @param n
     * @returns The size of the move stack.
     */
    var searchTo = function(n){
        var amt = moveStack.length - n;
        if(amt > 0){
            searchBack.call(that, amt);
        } else {
            searchForward.call(that, -1 * amt);
        }
        return moveStack.length;
    };
    
    
    
    /**
     * Ends search of movement history.
     * The argument 'keep' determines whether to keep the state of the Nonogram
     * as it is, or to restore it back to how it was before a search of move history.
     */
    var endSearch = function(keep){
        if(keep){
            searchStack.splice(0); //Clear stack.
        } else {
            searchForward(searchStack.length);
        }
    };
    
    
    
    var clearMoveHistory = function(){
        moveStack.splice(0);
        searchStack.splice(0);
    };
    
    
    
    ///////////////////////////////////////////////////////////////////////////
    // Various UI dialog boxes.
    ///////////////////////////////////////////////////////////////////////////
    
    
    
    /* 
     * Used as a helper to Nonogram.showAdjustHistoryDialog(),
     * To be called if such an element doesn't exist.
     */
    var makeAdjustHistoryDialog = function(){
        var dialogDiv = document.createElement("div");
        dialogDiv.id = tblID + "_history_div";
        dialogDiv.style.backgroundColor = "#BCBAAD";
        dialogDiv.style.padding = "30px";
        dialogDiv.style.textAlign = "center";
        document.body.appendChild(dialogDiv);

        var title = document.createElement("span");
        title.style.fontWeight = "bold";
        title.innerHTML = "Move History";
        dialogDiv.appendChild(title);
        dialogDiv.appendChild(document.createElement("br"));
        
        //Edit component
        var editDiv = document.createElement("div");
        editDiv.id = tblID + "_history_edit_div";
        editDiv.style.border = "2px ridge #777777";
        editDiv.style.width = "100%";
        editDiv.style.height = "50px";
        editDiv.style.overflow = "scroll";
        editDiv.style.overflowY = "hidden";
        dialogDiv.appendChild(editDiv);
        
        var innerDiv = document.createElement("div");
        innerDiv.id = tblID + "_history_inner_div";
        editDiv.appendChild(innerDiv);
        
        //Ok / Cancel buttons
        var okButton = document.createElement("input");
        okButton.type = "button";
        okButton.value = "Ok";
        okButton.onclick = function(){
            document.getElementById(tblID + "_history_div").style.visibility = "hidden";
            endSearch(true);
        };
        dialogDiv.appendChild(okButton);
        
        var cancelButton = document.createElement("input");
        cancelButton.type = "button";
        cancelButton.value = "Cancel";
        cancelButton.onclick = function(){
            document.getElementById(tblID + "_history_div").style.visibility = "hidden";
            endSearch(false);
        };
        dialogDiv.appendChild(cancelButton);
        
        return dialogDiv;
    };
    
    
    
    var setAdjustHistoryDialogPosition = function(dialogDiv, parentElem){
        var x = 250;
        var y = 150;
        if(parentElem){ //TODO: Decide how to position adjustHistory.
            var pos = findPosition(parentElem);
            x = pos[0];
            y = pos[1];
        }
        y += parentElem.offsetHeight;
        
        dialogDiv.offsetParent = document.getElementById(tblID + "_div");
        dialogDiv.style.position = "absolute";
        dialogDiv.style.left = x;
        dialogDiv.style.top = y;
        dialogDiv.style.width = parentElem.offsetWidth - 60;
        dialogDiv.style.height = 100;
    };
    
    
    
    var updateAdjustHistoryDialogComponent = function(){
        var innerDiv = document.getElementById(tblID + "_history_inner_div");
        var N = moveStack.length + searchStack.length;

        var minWidth = 10;
        var maxWidth = 80;
        var calcWidth = innerDiv.offsetParent.offsetWidth / (N+3); //edit div: document.getElementById(tblID + "_history_edit_div")
        var cellWidth = Math.max(minWidth, Math.min(maxWidth, calcWidth));
        var cellHeight = 50;
        innerDiv.style.width = cellWidth * (N+10);
        for(var i = 0; i <= N; i++){
            var unitID = tblID + "_history_" + i + "_div";
            var unitDiv = document.getElementById(unitID);
            if(!unitDiv){
                unitDiv = document.createElement("div");
                unitDiv.id = unitID;
                unitDiv.style.margin = 0;
                unitDiv.style.height = cellHeight;
                unitDiv.style.border = "1px solid black";
                unitDiv.style.cssFloat = "left";
                var puzzle = this;
                unitDiv.onmousedown = (function(num){
                        return function(){
                            searchTo.call(puzzle, num);
                            updateAdjustHistoryDialogComponent();
                        };
                    })(i);
                innerDiv.appendChild(unitDiv);
            }
            unitDiv.style.width = (i === moveStack.length) ? 5 : cellWidth; //Thin cell for current marker.
            unitDiv.style.backgroundColor = (i < moveStack.length) ? "red" : (i === moveStack.length ? "green" : "blue");
        }
        
        //Get rid of any extra elements. (Sequence assumed).
        var tmp;
        while((tmp = document.getElementById(tblID + "_history_" + i + "_div"))){
            innerDiv.removeChild(tmp);
            ++i;
        }
    };
    
    
    
    var showAdjustHistoryDialog = function(parentElem){
        //Get our dialog div.
        var dialogDiv = document.getElementById(tblID + "_history_div") || makeAdjustHistoryDialog();

        setAdjustHistoryDialogPosition(dialogDiv, document.getElementById(tblID + "_div"));
        updateAdjustHistoryDialogComponent();
        
        dialogDiv.style.visibility = "visible";
    };
    


    ///////////////////////////////////////////////////////////////////////////
    // Initialisation and misc. methods
    ///////////////////////////////////////////////////////////////////////////

    
    
    /**
     * Creates and returns an SVG element which reflects the current data in the nonogram.
     */
    var createSVGPreview = function (previewWidth, previewHeight, altData){
        //Ensure our proportions are okay.
        if(!previewWidth && !previewHeight){
            console.log("Change both");
            previewWidth = 400;
            previewHeight = previewWidth * height / width; 
        } else if(!previewHeight){
            console.log("Change preview height");
            previewHeight = previewWidth * height / width; 
        } else if(previewWidth <= 0){
            console.log("Change preview width");
            previewWidth = previewHeight * width / height;
        } else {
            console.log("Change none " + previewWidth + " " + previewHeight);
        }
        
        if(!altData) altData = that.data; //alt data better be the same size!!
        
        var xmlNS = "http://www.w3.org/2000/svg";
        var svgElem = document.createElementNS(xmlNS, "svg");
        svgElem.setAttributeNS(null, "version", "1.1");
        svgElem.setAttributeNS(null, "baseProfile", "full");
        
        svgElem.style.width = previewWidth;
        svgElem.style.height = previewHeight;
        
        var cellWidth = previewWidth / width;
        var cellHeight = previewHeight / height;
        
        for(var row = 0; row < height; row++){
            for(var col = 0; col < width; col++){
                if(altData[row][col] == 1){
                    //Blank.
                    var line1 = document.createElementNS(xmlNS, "line");
                    line1.setAttributeNS(null, "x1", "" + (col * cellWidth));
                    line1.setAttributeNS(null, "x2", "" + ((col + 1) * cellWidth));
                    line1.setAttributeNS(null, "y1", "" + (row * cellHeight));
                    line1.setAttributeNS(null, "y2", "" + ((row + 1) * cellHeight));
                    line1.setAttributeNS(null, "stroke", "grey");
                    line1.setAttributeNS(null, "stroke-width", "1");
                    svgElem.appendChild(line1);
                    
                    var line2 = document.createElementNS(xmlNS, "line");
                    line2.setAttributeNS(null, "x1", "" + (col * cellWidth));
                    line2.setAttributeNS(null, "x2", "" + ((col + 1) * cellWidth));
                    line2.setAttributeNS(null, "y1", "" + ((row + 1) * cellHeight));
                    line2.setAttributeNS(null, "y2", "" + (row * cellHeight));
                    line2.setAttributeNS(null, "stroke", "grey");
                    line2.setAttributeNS(null, "stroke-width", "1");
                    svgElem.appendChild(line2);
                }
                var box = document.createElementNS(xmlNS, "rect");
                box.setAttributeNS(null, "x", "" + (col * cellWidth));
                box.setAttributeNS(null, "y", "" + (row * cellHeight));
                box.setAttributeNS(null, "width", "" + cellWidth);
                box.setAttributeNS(null, "height", "" + cellHeight);
                box.setAttributeNS(null, "fill", palette.getColor(altData[row][col]).getStyleColor());
                svgElem.appendChild(box);
            }
        }
        
        return svgElem;
    };
    
    
    /**
     * Editability here refers to ability for the user to edit the clue rows
     * using the editing interface provided.
     * Clue rows, etc. are of course mutable via JavaScript code outside of
     * provided interfaces.
     * Editability does not affect a users ability to 'draw' cells.
     */
    var setEditable = function(b){
        editable = b;
        for(var type in clueUIs){
            if(clueUIs.hasOwnProperty(type)){
                for(var i = 0; i < clueUIs[type].length; i++){
                    clueUIs[type][i].setEditable(b);
                }
            }
        }
        palette.setEditable(b);
//        that.refresh();
    };

    
    
    var setActiveState = function(newState){
        if(VALID_STATES.indexOf(newState) < 0){
            throw "Error! New active State for " + tblID + " must be one of: " +
                VALID_STATES.join(", ") + ". Given: \"" + newState + "\".";
        }
        currentState = newState;
        return this;
    };
    
    
    
    var getActiveState = function(){
        return currentState;
    };
    
    
    
    var toPlayState = function(){
        setActiveState(PLAY_STATE);
        nono.setEditable(false);
    };
    
    
    
    var toEditState = function(){
        setActiveState(EDIT_STATE);
        nono.setEditable(true);
    };
    
    
    
    var toDrawState = function(){
        setActiveState(DRAW_STATE);
        nono.setEditable(false);
    };
    


    /**
     * Returns true if every row and column conforms to its clues.
     */
    var isSolved = function(){
        for(var row = 0; row < clueUIs[ROW].length; row++){
            if(!clueUIs[ROW][row].isValidRow(that.data[row])){
                return false;
            }
        }

        for(var col = 0; col < clueUIs[COL].length; col++){
            var colData = [];
            for(var row = 0; row < that.data.length; row++){
                colData[row] = that.data[row][col];
            }

            if(!clueUIs[COL][col].isValidRow(colData)){
                return false;
            }
        }

        return true;
    };



    var fireChange = function(){
        if(typeof that.onchange === "function"){
            that.onchange(that);
        }
    };



    var clearCells = function(){
        var arr = [];

        for(var row = 0; row < height; row++){
            arr[row] = [];
            for(var col = 0; col < width; col++){
                arr[row][col] = 0;
            }
        }

        that.setData(arr);
    };



    var clearClues = function(){
        var emptyClues = {};
        var arr = [];
        for(var row = 0; row < height; row++){
            arr.push([]);
        }
        emptyClues[ROW] = arr;

        arr = [];
        for(var col = 0; col < width; col++){
            arr.push([]);
        }
        emptyClues[COL] = arr;

        that.setClues(emptyClues);
    };
    
    
    
    //Have all our methods linked-to here.
    this.getID = function(){ return tblID; };
    this.writePuzzle = writePuzzle;
    this.refresh = refresh;
    this.getHTML = getHTML;
    this.createPuzzleElement = createPuzzleElement;
    this.appendPuzzleToElement = appendPuzzleToElement;
    
//    this.setCellStyleColor = setCellStyleColor;
//    this.setCellColor = setCellColor;
    this.getCellStyleColor = getCellColor;
    this.getCellColor = getCellColor;
    this.setCellData = setCellData;
    this.getWidth = function(){ return width; };
    this.getHeight = function(){ return height; };
    this.resizeTo = resizeTo;
    this.setData = setData;
    this.getData = getData;
    this.pushValues = pushValues;
    this.fetchValues = fetchValues;
    
    this.setPalette = setPalette;
    this.getPalette = getPalette;
    this.setClues = setClues;
    this.getClues = getClues;
    this.restoreMove = restoreMove;
    this.showAdjustHistoryDialog = showAdjustHistoryDialog;
    this.setEditable = setEditable;
    this.getColorIndicesInUse = function(){ return Nonogram.getColorIndicesInUse(this.getClues(), palette); };
    this.isSolved = isSolved;
    this.clearCells = clearCells;
    this.clearClues = clearClues;
    
    this.createSVGPreview = createSVGPreview;
    
    this.toPlayState = toPlayState;
    this.isPlayState = function(){ return getActiveState() === PLAY_STATE; };
    
    this.toEditState = toEditState;
    this.isEditState = function(){ return getActiveState() === EDIT_STATE; };
    
    this.toDrawState = toDrawState;
    this.isDrawState = function(){ return getActiveState() === DRAW_STATE; };



    if(!palette){
        palette = ColorPalette.DEFAULT.clone();
    }
    this.clearCells(); //Init this.data
};



/**
 Returns an object with properties {width,height} for
 a 2D array.
 */
Nonogram.getDimensions = function(arr){
    var width;
    width = arr.length;

    if(width === 0 || arr[0].length === 0){
        return {width: 0, height: 0};
    }

    return {width: arr[0].length, height: arr.length};
};


/**
 Returns a clue-set representation for a given nonogram puzzle.
 */
Nonogram.generateCluesFromSolution = function(data){
    var result = {};
    var rowClues = [];
    var colClues = [];
    result[ClueRowUI.TYPE_ROW] = rowClues;
    result[ClueRowUI.TYPE_COL] = colClues;

    var dim = Nonogram.getDimensions(data);
    if(dim.width === 0) return null; //No clues for no grid.

    //Generate row clues.
    for(var row = 0; row < dim.height; row++){
        rowClues[row] = ClueRowUI.describeRow(data[row]);
    }

    //Generate col clues.
    for(var col = 0; col < dim.width; col++){
        var colData = [];
        for(var row = 0; row < dim.height; row++){
            colData[row] = data[row][col];
        }

        colClues[col] = ClueRowUI.describeRow(colData);
    }

    return result;
};



/**
 * It may be that the clues of this Nonogram depend on
 * a palette of which this Nonogram does not make use of all
 * the palette's colors. This method will return a list of
 * indices which the Clues of this Nonogram make use of.
 */
Nonogram.getColorIndicesInUse = function(clues, palette){
    var inUseArr = [];
    for(var i = 0; i < palette.getSize(); i++){
        inUseArr[i] = i < 2; //0, 1 must be in use. Default to false.
    }
    
    for(var type in clues){
        if(clues.hasOwnProperty(type)){
            for(var i = 0; i < clues[type].length; i++){
                for(var j = 0; j < clues[type][i].length; j++){
                    inUseArr[clues[type][i][j].getClueColor()] = true;
                }
            }
        }
    }
    
    //Now check which indicies we have in use
    var result = [];
    for(var i = 0; i < inUseArr.length; i++){
        if(inUseArr[i]){
            result.push(i);
        }
    }
    
    return result;
};



/**
 * A function which makes a cell SVG.
 */ 
Nonogram.makeCellSVG = function(id){
    console.log("making svg cell: " + id);
    var xmlNS = "http://www.w3.org/2000/svg";
    var svgElem = document.createElementNS(xmlNS, "svg");
    svgElem.setAttributeNS(null, "version", "1.1");
    svgElem.setAttributeNS(null, "baseProfile", "full");
//    svgElem.setAttribute("xmlns", xmlNS);
    svgElem.id = id;
    svgElem.className = "square cell";
    
    console.log("made: " + svgElem.outerHTML);
    
    var line1 = document.createElementNS(xmlNS, "line");
    line1.id = id + "_line1";
    line1.setAttributeNS(null, "x1", "0");
    line1.setAttributeNS(null, "x2", "100%");
    line1.setAttributeNS(null, "y1", "0");
    line1.setAttributeNS(null, "y2", "100%");
    line1.setAttributeNS(null, "stroke", "grey");
    line1.setAttributeNS(null, "stroke-width", "1");
    line1.style.visibility = "hidden";
    svgElem.appendChild(line1);
    
    var line2 = document.createElementNS(xmlNS, "line");
    line2.id = id + "_line2";
    line2.setAttributeNS(null, "x1", "0");
    line2.setAttributeNS(null, "x2", "100%");
    line2.setAttributeNS(null, "y1", "100%");
    line2.setAttributeNS(null, "y2", "0");
    line2.setAttributeNS(null, "stroke", "grey");
    line2.setAttributeNS(null, "stroke-width", "1");
    line2.style.visibility = "hidden";
    svgElem.appendChild(line2);
    
    return svgElem;
};



Nonogram.updateCellSVG = function(svgElem, palette, number){
    if(!svgElem){ console.log("rtn.."); return; }
    
    // Cell color
    console.log("update bg color to: " + palette.getColor(number).getStyleColor() + " for " + svgElem.id);
    svgElem.style.backgroundColor = palette.getColor(number).getStyleColor();
//    svgElem.style.width = 15;
//    svgElem.style.height = 15;
    
    // Show/Hide lines.
    var str = number === 1 ? "visible" : "hidden";
    svgElem.childNodes[0].style.visibility = str;
    svgElem.childNodes[1].style.visibility = str;
};



var MultipleSolutionHandler = function(nono, solutions){
    var that = this;
    var selectedIndex = 0;
    
    var uiDiv = false;
    var solnsDiv = false;
    var solnsAdded = 0;
    
    var addSolution = function(data){
        solutions.push(data);
        addSolutionToDiv(data);
    };
    
    var selectSolution = function(i){
        selectedIndex = i;
        nono.setData(solutions[selectedIndex]);
        refreshUI();
    };
    

    var makeDialog = function(){
        uiDiv = document.createElement("div");
        uiDiv.id = nono.getID() + "_soln_div";
        uiDiv.style.backgroundColor = "#BCBAAD";
        uiDiv.style.padding = "30px";
        uiDiv.style.textAlign = "center";
        document.body.appendChild(uiDiv);

        var title = document.createElement("span");
        title.style.fontWeight = "bold";
        title.style.fontSize = "150%";
        title.innerHTML = "Select Solution";
        uiDiv.appendChild(title);
        uiDiv.appendChild(document.createElement("br"));

        var subtitle = document.createElement("span");
        subtitle.innerHTML = "Please select one solution to work upon.";
        uiDiv.appendChild(subtitle);
        uiDiv.appendChild(document.createElement("br"));
        
        //editDiv for scrollbar.
        var editDiv = document.createElement("div");
        editDiv.id = nono.getID() + "_soln_edit_div";
        editDiv.style.border = "2px ridge #777777";
        editDiv.style.width = "100%";
        //editDiv.style.height = "50px";
        editDiv.style.overflow = "scroll";
        editDiv.style.overflowY = "hidden";
        uiDiv.appendChild(editDiv);
        
        solnsDiv = document.createElement("div");
        solnsDiv.id = nono.getID() + "_soln_inner_div";
        for(var i = 0; i < solutions.length; i++)
            addSolutionToDiv(solutions[i]);
        editDiv.appendChild(solnsDiv);
        
        //Ok / Cancel buttons
        var okButton = document.createElement("input");
        okButton.type = "button";
        okButton.value = "Ok";
        okButton.onclick = function(){
            uiDiv.style.visibility = "hidden";
        };
        uiDiv.appendChild(okButton);
        
        var cancelButton = document.createElement("input");
        cancelButton.type = "button";
        cancelButton.value = "Cancel";
        cancelButton.onclick = function(){
            uiDiv.style.visibility = "hidden";
        };
        uiDiv.appendChild(cancelButton);
        
        return uiDiv;
    };
    
    var addSolutionToDiv = function(soln){
//        var spacer = document.createElement("span");
//        spacer.style.height = 5;
//        spacer.style.width = 25;
//        spacer.style.float = "left";
//        solnsDiv.appendChild(spacer);
        
        var container = document.createElement("span");
        container.style.background = ["#BBBBBB", "#E0E0E0"][solnsAdded % 2];
        container.style.float = "left";
//        container.style.height = 200;
        container.style.padding = "10 px";
        solnsDiv.appendChild(container);
        
        var preview = nono.createSVGPreview(-1, window.innerHeight / 3, soln);
        preview.style.float = "left";
        preview.onclick = (function(val){ return function(){
            console.log("Select solution " + val);
            selectSolution(val);
        }; })(solnsAdded);
        container.appendChild(preview);
//        solnsDiv.appendChild(preview);
        
        solnsAdded++;
        refreshUI();
    };
    
    var showUI = function(){
        if(!uiDiv) makeDialog();

        uiDiv.style.position = "absolute";
        uiDiv.style.left = 0;
        uiDiv.style.top = window.innerHeight / 6 + window.scrollY;
        uiDiv.style.width = window.innerWidth - 60 - 16; //30px padding.
        uiDiv.style.height = window.innerHeight * 3 / 5;
        
        uiDiv.style.visibility = "visible";
    };
    
    var refreshUI = function(){
        // selectedIndex
        for(var i = 0; solnsDiv.childNodes && i < solnsDiv.childNodes.length; i++){
            solnsDiv.childNodes[i].style.backgroundColor = (selectedIndex == i) ? "#FFFF00" : ["#BBBBBB", "#E0E0E0"][i % 2]; 
        }
    };
    
    this.addSolution = addSolution;
    this.getSolutions = function(){ return solutions; };
    this.getSelectedIndex = function(){ return selectedIndex; };
    this.selectSolution = selectSolution;
    this.showUI = showUI;
    this.refreshUI = refreshUI();
};






//Object-style data structure.
var Clue = function(colorIndex, count){
    return {
        setClueColor: function(c){ colorIndex = c; return this; },
        getClueColor: function(){ return colorIndex; },
        setClueCount: function(c){ count = c; return this; },
        getClueCount: function(){ return count; },
        toString: function(){ return "Clue(" + this.getClueColor() + "," + this.getClueCount() + ")"; }
    };
};






/**
 * === Clue Representation: ===
 * - Representation of clue sequences is simply an
 *    array of class objects, where each item is a
 *    Clue object.
 */
var ClueRowUI = function(tblID, rowNum, type, editable, palette){
    if(!palette){
        palette = ColorPalette.DEFAULT.clone();
    }

    var that = this;
    this.data = [];

    var id = tblID + "_" + type + rowNum;
    var textfields = [];



    //Appends one text field to this ClueEntry widget
    var addTextfield = function(){
        var t = {id: id + "_textfield" + textfields.length, className: "square clue", style: {}};
        textfields.push(t);
        that.refresh(); //Refresh variables from this object to DOM.
    };



    var ensureTextfieldCount = function(num){
        while(num > textfields.length){
            that.addTextfield();
        }
    };



    var refreshTextfieldArray = function(){
        //Set elements in the textfield array to their DOM counterparts.
        for(var i = 0; i < textfields.length; i++){
            var t = document.getElementById(id + "_textfield" + i);
            if(t){
                textfields[i] = t;
            }
            
            t.oncontextmenu = function(){ return false; }; //Disable right-click menus.
            
            t.onfocus = (function(num){ return function(){
                if(editable && !that.data[that.data.length - num - 1]){
                    that.data[num] = new Clue(2, 0);
                    pushValueOf(num); //Set this.
                }
            }; })(i);
            
            t.onblur = (function(num){ return function(){
                if(!editable){ return; }
                var clue = that.data[num];
                if(!clue){ console.log("ERROR: Clue not found for textfield!"); }
                
                //Set clue properties from textfield.
                fetchValueOf(num);
            }; })(i);
            
            t.onmousedown = (function(num){ return function(e){
                if(editable && e.button === 2){
                    //Cycle colors
                    var clue = that.data[num];
                    if(!clue){ console.log("Can't change color, no clue set"); return; }
                    var color = (clue.getClueColor() + 1 < palette.getSize()) ? clue.getClueColor() + 1 : 2;
                    clue.setClueColor(color);
                    pushValueOf(num);
                }
            }; })(i);
        }
    };



    var refresh = function(){
        var div = getDivElement();
        if(!div){ return; }

        div.innerHTML = that.getHTML();
        (document.getElementById(id + "_addclue_btn") || {}).onclick = function(){ that.addTextfield(); };
        (document.getElementById(id + "_setclues_btn") || {}).onclick = function(){ that.showEditDialog(); };
        refreshTextfieldArray();
        pushValues();
    };



    var write = function(){
        document.writeln("<div id=\"" + id + "_div\"></div>");
        that.refresh();
    };



    var getHTML = function(){
        var htmlStr = "";

        if(editable){
            //TODO: Replace these buttons with tables or images. Buttons are very tedious across browsers. :-)
            htmlStr += "<input type=\"button\" class=\"square\" name=\"" + id + "_addclue_btn\" style=\"vertical-align: bottom; padding: 0px; \" " +
            "id=\"" + id + "_addclue_btn\" value=\"+\" />";
            htmlStr += (type === ClueRowUI.TYPE_COL ? "<br>" : "");


            htmlStr += "<input type=\"button\" class=\"square\" name=\"" + id + "_setclues_btn\" style=\"vertical-align: bottom; padding: 0px; \" " +
            "id=\"" + id + "_setclues_btn\" value=\":=\" />";
            htmlStr += (type === ClueRowUI.TYPE_COL ? "<br>" : "");
        }

        for(var i = textfields.length - 1; i >= 0; --i){
            var t = textfields[i];
            htmlStr += "<input type=\"text\" name=\"" + t.id +
            "\" id=\"" + t.id + "\" class=\"" + "square cell" + //t.className
            "\" value=\"" + (t.value || '') + "\" maxlength=\"2\"";
            htmlStr += (!editable ? "readonly=\"readonly\"" : "") + " />";
            htmlStr += (type === ClueRowUI.TYPE_COL ? "<br>" : "");
        }

        return htmlStr;
    };



    var setClues = function(nClues){
        if(nClues.length > 0 && typeof nClues[0] === "number"){
            console.log("WARNING: Archaic data type for setClues.");
            nClues = convertToComplexRepresentation(nClues);
        }

        that.data = nClues.slice(0).reverse(); //Clues are stored in reverse.
        pushValues();
    };



    var getClues = function(){
        var result = [];
        for(var i = that.data.length - 1; i >= 0; --i){
            var clue = that.data[i];
            if(clue && clue.getClueCount() > 0 && clue.getClueColor() >= 2){
                result.push(clue);
            }
        }
        return result;
    };



    /**
     DOM -> data
     */
//    this.fetchValues = function(){
//        var result = [];
//
//        //from left to right, as it appears in the document.
//        for(var i = textfields.length-1; i >=0; --i){
//            var val = textfields[i].value;
//            var color = palette.getColorIndexByBackgroundColor(textfields[i].style.backgroundColor); ///TODO: This better work.
//            if(textfields[i].value !== '' && (color < 1 || val < 1)){
//                console.log("fetching:" + textfields[i].value + "->" + val + ":" + textfields[i].style.backgroundColor + "->" + color);
//            }
//            if(val){
//                result.push(new Clue(color, +val)); //Convert to int. TODO: input validation.
//            }
//        }
//
//        this.data = result;
//    };
    
    
    
    /**
     * DOM -> data (for an individual cell).
     * 
     * Parameter indicates the textfield number to push the data for.
     */
    var fetchValueOf = function(textfieldNum){
        var val = textfields[textfieldNum].value;
        var bgColor = textfields[textfieldNum].style.backgroundColor;
        var color = findColorForTextfield(textfields[textfieldNum]);
        console.log("FetchValueOf:" + val + ":" + bgColor + "=" + color);
        
        var clue = that.data[textfieldNum];
        clue.setClueCount(val);
        clue.setClueColor(color);
    };
    
    
    
    /**
     * Returns the color index of the current palette
     * for the first color which has the same text and background
     * style colors.
     */
    var findColorForTextfield = function(textfield){
        //Skip blank colors.
        for(var i = 2; i < palette.getSize(); i++){
            var color = palette.getColor(i);
            if(sameColors(color.getTextColor(),textfield.style.color) &&
                    sameColors(color.getBackgroundColor(),textfield.style.backgroundColor)){
                return i;
            }
        }
        return -1;
    };



    /**
     data -> DOM

     If there are less textfields than this.data,
     then more text fields are added.
     */
    var pushValues = function(){
        that.ensureTextfieldCount(that.data.length);

        for(var i = 0; i < textfields.length; i++){
            pushValueOf(i);
        }
    };
    
    
    
    /**
     * data -> DOM (for an individual cell).
     * 
     * Parameter indicates the textfield number to push the data for.
     */
    var pushValueOf = function(textfieldNum){
        var clue = that.data[textfieldNum] || new Clue(0, 0);
        var color = palette.getColor(clue.getClueColor());

        if(!color){ console.log("No color for!:" + clue.getClueColor() + "::" + clue.toString()); }
        //Unnecessary to do the check here, in a way, but to distinguish between 0 and undefined.
        //this.textfields[textfieldNum].value = (value !== undefined) ? value : '';
        textfields[textfieldNum].value = clue.getClueCount() || '';
        textfields[textfieldNum].style.color = color.getTextColor();
        textfields[textfieldNum].style.backgroundColor = color.getBackgroundColor();
    };



    var setEditable = function(b){
        if(b === editable){ return; }
        
        editable = b;
        (getDivElement() || {}).innerHTML = that.getHTML();
        that.refresh();
    };



    var isEditable = function(){
        return editable;
    };



    var setPalette = function(p){
        palette = p;
        pushValues();
    };
    
    
    
    var getPalette = function(){
        return palette;
    };



    var getDivElement = function(){
        return document.getElementById(id + "_div");
    };



    var getID = function(){
        return id;
    };



    /**
     Returns true if the given row of data conforms to
     the clue sequence given by this clue widget.
     */
    var isValidRow = function(data){
        var tmp = ClueRowUI.describeRow(data);
        var my_stuff = that.getClues();
        
        if(tmp.length != my_stuff.length){
            return false;
        }

        for(var i = 0; i < my_stuff.length; i++){
            if(tmp[i].getClueColor() !== my_stuff[i].getClueColor() ||
                    tmp[i].getClueCount() !== my_stuff[i].getClueCount()){
                return false;
            }
        }

        return true;
    };
    
    
    
    /**
     * Makes an Edit-Dialog for this Clue Row.
     * For the use of Show Edit dialog.
     */
    var makeEditDialog = function(){
        var saveEdit = function(){
            
        };
        
        var editDialog = document.createElement("div");
        editDialog.id = id + "_edit_dialog";
        editDialog.style.backgroundColor = "#CCCCCC";
        editDialog.style.padding = "5px";
        editDialog.style.textAlign = "center";
        
        //initial components. (These won't change).
        var titleElem = document.createElement("span");
        titleElem.innerHTML = "Edit Clue<br>" + {"row": "Row", "col": "Column"}[type] + " " + rowNum;
        titleElem.style.fontWeight = "bold";
        editDialog.appendChild(titleElem);
        
        editDialog.appendChild(document.createElement("br"));
        
        var addBtn = document.createElement("input");
        addBtn.type = "button";
        addBtn.value = "+";
        editDialog.appendChild(addBtn);
        
        editTbl = document.createElement("table");
        editTbl.id = id + "_edit_table";
        //TODO: TR setup and stuff.
        editDialog.appendChild(editTbl);
        editDialog.appendChild(document.createElement("br"));
        
        var editPaletteBtn = document.createElement("input");
        editPaletteBtn.type = "button";
        editPaletteBtn.value = "Edit Palette";
        editDialog.appendChild(editPaletteBtn);
        editDialog.appendChild(document.createElement("br"));
        
        var okBtn = document.createElement("input");
        okBtn.type = "button";
        okBtn.value = "Okay";
        okBtn.onclick = function(){
            saveEdit();
            editDialog.style.visibility = "hidden";
        };
        editDialog.appendChild(okBtn);
        var cancelBtn = document.createElement("input");
        cancelBtn.type = "button";
        cancelBtn.value = "Cancel";
        cancelBtn.onclick = function(){
            editDialog.style.visibility = "hidden";
        };
        editDialog.appendChild(cancelBtn);
        document.body.appendChild(editDialog);
        return editDialog;
    };
    
    
    
    /**
     * Updates the table of data in the edit dialog.
     */
    var updateEditDialog = function(){
        var getTextfield = function(num){
            var t_id = id + "_edit_textfield" + num;
            var textElem = document.getElementById(t_id);
            if(!textElem){
                textElem = document.createElement("input");
                textElem.id = num;
                textElem.type = "text";
                textElem.style.width = 40;
                textElem.style.height = 40;
            }
            return textElem;
        };
        
        var getButton = function (num){
            var b_id = id + "_edit_color_button" + i;
            var btnElem = document.getElementById(b_id);
            if(!btnElem){
                btnElem = document.createElement("input");
                btnElem.id = b_id;
                btnElem.type = "button";
                btnElem.value = "...";
                btnElem.style.width = 40;
                btnElem.style.height = 40;
            }
            return btnElem;
        };
        
        var editTable = document.getElementById(id + "_edit_table");
        if(!editTable){ return; }

        var textRow = document.getElementById(id + "_edit_table_row1");
        var btnRow = document.getElementById(id + "_edit_table_row2");
        
//        var prevTextElem = getTextfied(0);
//        var prevBtnElem = getButton(0);
//        if(!textRow.contains(prevTextElem)){
//            textRow.appendChild(prevTextElem); //TD?
//        }
//        
//        //Update edit-dialog table to reflect the textfields of the ClueRowUI
//        for(var i = 1; i < textfields.length; i++){
//            var textElem = getTextfield(i);
//            var btnElem = getButton(i);
//            
//            
//            
//            prevTextElem = textElem;
//            prevBtnElem = btnElem;
//        }
//        while(i){
//            i++;
//        }
    };
    
    
    
    var showEditDialog = function(){
        var editDialog = document.getElementById(id + "_edit_dialog") || makeEditDialog();
        
        updateEditDialog();
        
        //Set position and show
        editDialog.style.position = "absolute";
        var position = findPosition(getDivElement());
        editDialog.style.left = position[0] + ((type === ClueRowUI.TYPE_COL) ? getDivElement().offsetWidth : 0);
        editDialog.style.top = position[1] + ((type === ClueRowUI.TYPE_ROW) ? getDivElement().offsetHeight : 0);
        editDialog.style.visibility = "visible";
    };



    //Set methods here
    this.describeRow = ClueRowUI.describeRow;
    this.addTextfield = addTextfield;
    this.ensureTextfieldCount = ensureTextfieldCount;
    this.refresh = refresh;
    this.write = write;
    this.getHTML = getHTML;
    this.setClues = setClues;
    this.getClues = getClues;
    this.setEditable = setEditable;
    this.isEditable = isEditable;
    this.setPalette = setPalette;
    this.getPalette = getPalette;
    this.getID = getID;
    this.isValidRow = isValidRow;
    this.showEditDialog = showEditDialog;
    
    
    
    
    this.ensureTextfieldCount(ClueRowUI.INITIAL_CLUE_NUM);
};



/**
  For a given row of data, this method
  will return an array describing the 'clue' for the row.
 */
ClueRowUI.describeRow = function(data){
    if(!data || data.length === 0){ return []; };

    var result = [];
    var color = data[0];
    var counter = 0;

    for(var i = 0; i < data.length; i++){
        if(+data[i] === color){
            counter++;
        } else {
            if(counter > 0 && color >= 2){ //Color not blank, not space
                result.push(new Clue(color,counter));
            }
            color = +data[i];
            counter = 1;
        }
    }

    if(counter > 0 && color >= 2){
        result.push(new Clue(color,counter));
    }

    return result;
};

ClueRowUI.TYPE_ROW = "row";
ClueRowUI.TYPE_COL = "col";
ClueRowUI.INITIAL_CLUE_NUM = 5;






///////////////////////////////////////////////////////////////////////////////
// Color Palette
///////////////////////////////////////////////////////////////////////////////

//Table of color names vs hex values.
//Table from http://stackoverflow.com/questions/1573053/javascript-function-to-convert-color-names-to-hex-codes
var web_colors = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
        "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
        "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
        "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
        "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
        "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
        "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
        "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
        "honeydew":"#f0fff0","hotpink":"#ff69b4",
        "indianred ":"#cd5c5c","indigo ":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
        "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
        "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
        "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
        "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
        "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
        "navajowhite":"#ffdead","navy":"#000080",
        "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
        "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
        "red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
        "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
        "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
        "violet":"#ee82ee",
        "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
        "yellow":"#ffff00","yellowgreen":"#9acd32"};



var toHexValue = function(str){
    var tmp;
    str = str.toUpperCase();
    if(/^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.test(str)){
        return str;
    } else if(tmp = /^RGB\((\d+),\s*(\d+),\s*(\d*)\)$/i.exec(str)){
        //Convert RGB parts to a HEX color string.
        return "#" + tmp.slice(1).map(function(x){ return ("0" + (+x).toString(16)).slice(-2).toUpperCase(); }).join("");
    } else {
        return web_colors[str.toLowerCase()].toUpperCase();
    }
};



/**
 * Takes two strings (e.g. "red", "#ff0000"),
 * and returns true if they are both equal.
 */
var sameColors = function(color1, color2){
    console.log("SameColor?" +
            color1 + ":" + toHexValue(color1) + "===" +
            color2 + ":" + toHexValue(color2) + "?" +
            (toHexValue(color1) === toHexValue(color2)));
    return toHexValue(color1) === toHexValue(color2) && color1 && color2;
};



//?? Can this be enhanced by using a color library/functions?
var Color = function(name, color, clueText, clueBackground, mutable){
    if(!clueBackground){
        clueBackground = color;
    }
    
    this.setColorName = function(n){ if(mutable) name = n; return this; };
    this.getColorName = function(){ return name; };                //for display name
    
    this.setStyleColor = function(n){ if(mutable) color = n; return this; };
    this.getStyleColor = function(){ return color; };              //for Nonogram picture
    
    this.setTextColor = function(n){ if(mutable) clueText = n; return this; };
    this.getTextColor = function(){ return clueText; };            //for Clue textfield
    
    this.setBackgroundColor = function(n){ if(mutable) clueBackground = n; return this; };
    this.getBackgroundColor = function(){ return clueBackground; }; //for Clue textfield
    
    this.setMutable = function(b){ mutable = b; return this; };
    this.isMutable = function(){ return mutable; };
    this.toString = function(){ return name; };
    
    //All properties are the same.
    this.equalsColor = function(c){ return this.getColorName() === c.getColorName() &&
                                           sameColors(this.getStyleColor(), c.getStyleColor()) &&
                                           sameColors(this.getTextColor(), c.getTextColor()) &&
                                           sameColors(this.getBackgroundColor(), c.getBackgroundColor()); };
};



var ColorUI = function(color, editable, plainDisplay){
    ColorUI.NUMBER = ColorUI.NUMBER ? ColorUI.NUMBER + 1 : 1;
    
    var id = "Color" + color.getColorName() + "UI_" + ColorUI.NUMBER;
    var editDialogID = id + "_edit_dialog";
    var selected = false;
    var that = this;
    
    var divElem = null;
    
    
    
    var write = function(){
        document.writeln("<div id=\"" + id + "_div\"></div>");
        divElem = document.getElementById(id + "_div");
        that.refresh();
    };
    
    
    
    var appendToElement = function(element){
        divElem = document.createElement("div");
        divElem.id = id + "_div";
        element.appendChild(divElem);
        that.refresh();
    };
    
    
    
    var refresh = function(){
        if(!divElem){
            throw "Div element has not been initialised for " + id + " Color UI";
        } else {
            var o = document.getElementById(id + "_div");
            
            if(o && divElem !== o) {
                // If the user invoked .write somewhere, then
                // the element we are refering to will be different
                // than the element in the document.
                o.parentElement && o.parentElement.replaceChild(divElem, o);
            }
        }
        
        divElem.style.padding = 5;
        var height = 25;
        
        if(!divElem.getChildById){
            divElem.getChildById = function(id){
                for(var i = 0; i < this.children.length; i++){
                    if(this.children[i].id == id){
                        return this.children[i];
                    }
                }
            };
        }
        
        // This may or may not be useful to replace with an SVG image..
        var colorPreviewDiv = divElem.getChildById(id + "_colorPreview"); // = document.getElementById(id + "_colorPreview");
        var previewSvgElem;
        if(!colorPreviewDiv){
            colorPreviewDiv = document.createElement("div");
            colorPreviewDiv.id = id + "_colorPreview";
            colorPreviewDiv.style.width = height;
            colorPreviewDiv.style.height = height;
            colorPreviewDiv.style.boxSizing = "border-box";
            colorPreviewDiv.style.border = "2px solid";
            colorPreviewDiv.style.cssFloat = "left";
            
            previewSvgElem = Nonogram.makeCellSVG(id + "_preview_svg");
            colorPreviewDiv.appendChild(previewSvgElem);
            
            divElem.appendChild(colorPreviewDiv);
        }
//        colorPreviewDiv.style.backgroundColor = color.getStyleColor();
        colorPreviewDiv.style.borderColor = color.getTextColor();

        var textDisplay = divElem.getChildById(id + "_name_display"); // = document.getElementById(id + "_name_display");
        if(!textDisplay){
            textDisplay = document.createElement("input");
            textDisplay.id = id + "_name_display";
            textDisplay.type = "text";
            textDisplay.setAttribute("readOnly","readOnly");
            textDisplay.style.position = "relative";
            divElem.appendChild(textDisplay);
            var y = 3;
            textDisplay.style.top = y;
            textDisplay.style.height = height - (3 * y); //colorPreviewDiv.offsetHeight - (2 * y);
            textDisplay.style.fontSize = height * (4/7); //textDisplay.offsetHeight * (4/5);
        }
        if(plainDisplay){
            textDisplay.style.border = "0px none";
            textDisplay.style.backgroundColor = "transparent";
            textDisplay.style.color = "#000000";
        } else {
            textDisplay.style.border = "2px inset " + color.getBackgroundColor();
            textDisplay.style.backgroundColor = color.getBackgroundColor();
            textDisplay.style.color = color.getTextColor();
        }
        textDisplay.size = color.getColorName().length;
        textDisplay.value = color.getColorName()[0].toUpperCase() + color.getColorName().substr(1);
        
        var closeButton = divElem.getChildById(id + "_close_button"); // = document.getElementById(id + "_close_button");
        if(!closeButton){
            closeButton = document.createElement("input");
            closeButton.id = id + "_close_button";
            closeButton.type = "button";
            closeButton.value = "X";
            closeButton.style.width = height;
            closeButton.style.height = height;
            closeButton.style.cssFloat = "right";
            closeButton.onclick = function(){
                (that.ondelete || function(){})();
            };
            divElem.appendChild(closeButton);
        }

        var editButton = divElem.getChildById(id + "_edit_button"); // = document.getElementById(id + "_edit_button");
        if(!editButton){
            editButton = document.createElement("input");
            editButton.id = id + "_edit_button";
            editButton.type = "button";
            editButton.value = "...";
            editButton.style.height = height;
            editButton.style.width = height;
            editButton.style.cssFloat = "right";
            editButton.onclick = function(){
                that.showEditDialog();
            };
            divElem.appendChild(editButton);
        }

        if(editable && color.isMutable()){
            editButton.style.visibility = "inherit";
            closeButton.style.visibility = "inherit";
        } else {
            editButton.style.visibility = "hidden";
            closeButton.style.visibility = "hidden";
        }

        if(!divElem.getChildById(id + "_br")){
            var br = document.createElement("br");
            br.id = id + "_br";
            br.style.clear = "both";
            divElem.appendChild(br);
        }
    };
    
    
    
    var getDiv = function(){
        return divElem;
    };
    
    
    
    var showEditDialog = function(){
        //Color -> EditUI
        var pushValues = function(){
            (document.getElementById(editDialogID + "_Name") || {}).value = color.getColorName();
            (document.getElementById(editDialogID + "_Color") || {}).value = color.getStyleColor();
            (document.getElementById(editDialogID + "_Text") || {}).value = color.getTextColor();
            (document.getElementById(editDialogID + "_Background") || {}).value = color.getBackgroundColor(); 
        };
        
        //EditUI -> Color
        var fetchValues = function(){
            color.setColorName(document.getElementById(editDialogID + "_Name").value);
            color.setStyleColor(document.getElementById(editDialogID + "_Color").value);
            color.setTextColor(document.getElementById(editDialogID + "_Text").value);
            color.setBackgroundColor(document.getElementById(editDialogID + "_Background").value);
        };
        
        var editDialog = document.getElementById(editDialogID);
        if(!editDialog){
            editDialog = document.createElement("table");
            editDialog.id = editDialogID;
            editDialog.style.backgroundColor = "#CCCCCC";
            editDialog.style.border = "1px inset black";
            editDialog.style.fontSize = "12px";
            editDialog.style.zIndex = that.getDiv().style.zIndex + 100;
            document.body.appendChild(editDialog);
            
            for(var i = 0; i < 6; i++){
                var rowElem = document.createElement("tr");
                rowElem.id = editDialogID + "_row" + i;
                editDialog.appendChild(rowElem);
            }
            
            var titleElement = document.createElement("td");
            titleElement.setAttribute("colspan", 2);
            titleElement.style.textAlign = "center";
            titleElement.style.fontWeight = "bold";
            titleElement.innerHTML = "Edit Color";
            document.getElementById(editDialogID + "_row0").appendChild(titleElement);

            for(var i = 1; i < 5; i++){
                var labelElem = document.createElement("td");
                labelElem.style.textAlign = "right";
                labelElem.innerHTML = ["Name","Color","Text","Background"][i - 1] + ":";
                document.getElementById(editDialogID + "_row" + i).appendChild(labelElem);
                
                var textElem = document.createElement("td");
                var inputElem = document.createElement("input");
                inputElem.id = editDialogID + "_" + ["Name","Color","Text","Background"][i - 1];
                inputElem.type = "text";
                textElem.appendChild(inputElem);
                document.getElementById(editDialogID + "_row" + i).appendChild(textElem);
            }
            
            var responseElem = document.createElement("td");
            responseElem.setAttribute("colspan", 2);
            responseElem.style.textAlign = "center";
            var okButton = document.createElement("input");
            okButton.type = "button";
            okButton.value = "Okay";
            okButton.style.padding = 4;
            okButton.style.fontSize = "8px";
            okButton.onclick = function(){
                document.getElementById(editDialogID).style.visibility = "hidden";
                fetchValues();
                that.refresh();
            };
            responseElem.appendChild(okButton);
            var cancelButton = document.createElement("input");
            cancelButton.type = "button";
            cancelButton.value = "Cancel";
            cancelButton.style.padding = 4;
            cancelButton.style.fontSize = "8px";
            cancelButton.onclick = function(){
                document.getElementById(editDialogID).style.visibility = "hidden";
            };
            responseElem.appendChild(cancelButton);
            document.getElementById(editDialogID + "_row" + 5).appendChild(responseElem);
        }
        editDialog.style.position = "absolute"; //TODO: Adjust positioning of edit dialog.
        var parentPosition = findPosition(that.getDiv());
        editDialog.style.left = parentPosition[0];
        editDialog.style.top = parentPosition[1] + that.getDiv().offsetHeight - 10;
        editDialog.style.zIndex = that.getDiv().style.zIndex + 100;
        pushValues();
        editDialog.style.visibility = "visible";
    };
    
    
    
    var setEditable = function(b){
        editable = b && color.isMutable();
    };
    
    
    
    var isEditable = function(){
        return editable;
    };
    
    
    
    var setColor = function(c){
        color = c;
        that.refresh();
    };
    
    
    
    var getColor = function(){
        return color;
    };
    
    
    
    /**
     * Sets whether the style of the Color name textfield is
     * plain or shows the color.
     */
    var setPlainDisplay = function(b){
        plainDisplay = b;
    };
    
    
    
    var getPlainDisplay = function(){
        return plainDisplay;
    };
    
    
    
    var setSelected = function(b){
        selected = b; //Handle selected color, etc. done by parent.
    };
    
    
    
    var isSelected = function(){
        return selected;
    };
    
    

    //Set methods
    this.write = write;
    this.appendToElement = appendToElement;
    this.refresh = refresh;
    this.refresh = refresh;
    this.getDiv = getDiv;
    this.getSVG = function(){ return document.getElementById(id + "_preview_svg"); };
    this.showEditDialog = showEditDialog;
    this.setEditable = setEditable;
    this.isEditable = isEditable;
    this.setColor = setColor;
    this.getColor = getColor;
    this.setPlainDisplay = setPlainDisplay;
    this.getPlainDisplay = getPlainDisplay;
    this.setSelected = setSelected;
    this.isSelected = isSelected;
};






//Call with additional colors to constructor.
var ColorPalette = function(name){
    var colors = [];
    
    //Add the additional arguments as colors.
    for(var i = 1; i < arguments.length; i++){
        colors.push(arguments[i]);
    }
    
    var dependentUIs = [];
    var that = this;



    var addColor = function(clr){
        colors.push(clr);
    };
    
    
    
    var removeColor = function(clr){
        if(getColorIndex(clr) < 0){ return; }
        colors.splice(getColorIndex(clr), 1);
    };



    var setColors = function(nColors){
        colors = nColors;
    };



    var getColors = function(){
        return colors;
    };
    
    
    
    var getSize = function(){
        return colors.length;
    };



    var getColor = function(index){
        return colors[+index];
    };



    var getStyleColor = function(index){
        return colors[+index].getStyleColor();
    };



    var getColorIndex = function(color){
        for(var i in colors){
            if(colors.hasOwnProperty(i) && colors[i] === color){
                return +i;
            }
        }
        return -1;
    };



    var getColorIndexByStyleColor = function(colorStr){
        for(var i in colors){
            if(colors.hasOwnProperty(i) && sameColors(colors[i].getStyleColor(), colorStr)){
                return +i;
            }
        }
        return -1;
    };



    var getColorIndexByBackgroundColor = function(colorStr){
        for(var i in colors){
            if(colors.hasOwnProperty(i) && sameColors(colors[i].getBackgroundColor(), colorStr)){
                return +i;
            }
        }
        return -1;
    };



    var setCurrentIndex = function(c){
        that.selectorUI.selectColor(c);
    };



    var getCurrentIndex = function(){
        //Return the index of the first guy who this makes sense for.
        for(var i = 0; i < dependentUIs.length; i++){
            if(dependentUIs[i].getSelectedIndex)
                return dependentUIs[i].getSelectedIndex();
        }
    };



    var getCurrentColor = function(){
        return that.getColor(that.getCurrentIndex());
    };



    // Compares colors (name ignored). MUST be in the same order.
    // Colors compared by Color.equalsColor.
    var equalsPalette = function(otherPalette){
        var otherCols = otherPalette.getColors();

        if(otherCols.length != colors.length){
            return false;
        }

        for(var i = 0; i < otherCols.length; i++){
            if(!otherCols[i].equalsColor(colors[i])){
                return false;
            }
        }

        return true;
    };



    var clone = function(){
        var cp = new ColorPalette(name);
        cp.setColors(that.getColors().slice(0));
        return cp;
    };



    var getName = function(){
        return name;
    };

    
    
    var refresh = function(){
        dependentUIs.forEach(function(ui){ return ui.refresh(); });
    };
    
    
    
    var addDependentUI = function(ui){
        dependentUIs.push(ui);
    };
    
    
    
    var removeDependentUI = function(ui){
        var i = dependentUIs.indexOf(ui);
        if(i >= 0){
            dependentUIs.splice(i, 1);
        }
    };
    
    
    
    var setEditable = function(b){
        for(var i = 0; i < colors.length; i++){
            colors[i].setMutable(b);
        }
        that.refresh();
    };
    
    //Editable if all colors are mutable.
    var isEditable = function(){
        for(var i = 0; i < colors.length; i++){
            if(!colors[i].isMutable()) return false;
        }
        return true;
    };

    
    var toString = function(){
        return name + ":" + colors.join(",");
    };
    
    
    
    //Set methods
    this.addColor = addColor;
    this.removeColor = removeColor;
    this.setColors = setColors;
    this.getColors = getColors;
    this.getSize = getSize;
    this.getColor = getColor;
    this.getStyleColor = getStyleColor;
    this.getColorIndex = getColorIndex;
    this.getColorIndexByStyleColor = getColorIndexByStyleColor;
    this.getColorIndexByBackgroundColor = getColorIndexByBackgroundColor;
    this.setCurrentIndex = setCurrentIndex;
    this.getCurrentIndex = getCurrentIndex;
    this.getCurrentColor = getCurrentColor;
    this.equalsPalette = equalsPalette;
    this.clone = clone;
    this.getName = getName;
    this.refresh = refresh;
    this.addDependentUI = addDependentUI;
    this.removeDependentUI = removeDependentUI;
    this.getDependentUIs = function(){ return dependentUIs.slice(0); };
    this.setEditable = setEditable;
    this.isEditable = isEditable;
    this.toString = toString;

    this.writeBrushSelectorUI = function(){ return ColorPalette.writeBrushSelectorUI(that); };
    this.appendBrushSelectorUI = function(div){ return ColorPalette.appendBrushSelectorUI(that, div); };
};


/**
 * Returns an object containing a new DIV element while has the UI for
 * brush selection for the Nonogram UI, and the ColorSelectorUI used
 * in the created Brush Selection ui.
 * 
 * This mainly serves as a helper to ColorPalette.writeBrushSelectorUI(p),
 * and to ColorPalette.appendBrushSelectorUI(p, div).
 */
ColorPalette.createBrushSelectorUI = function(palette){
    var uiNumber = 0; //Find a free number for brush selector.
    while(document.getElementById("brush_selector_ui" + uiNumber + "_div")){
        ++uiNumber;
    }
    
    var div = document.createElement("div");
    div.id = "brush_selector_ui" + uiNumber + "_div";
    div.style.border = "1px solid";
    div.style.padding = "10px";

    if(div.getElementsByTagName("b").length === 0){
        var title = document.createElement("b");
        title.innerHTML = "Brush Type";
        div.appendChild(title);
    }

    var selectorUI = new ColorSelectorUI(palette, true);
    palette.addDependentUI(selectorUI);
    selectorUI.appendToElement(div);
    
    return {div: div, ui: selectorUI};
};



//Returns the ColorSelectorUI used.
ColorPalette.writeBrushSelectorUI = function(palette){
    var obj = ColorPalette.createBrushSelectorUI(palette);
    document.writeln(obj.div.outerHTML);
    palette.refresh();
    return obj.ui;
};



// Returns the ColorSelectorUI used.
ColorPalette.appendBrushSelectorUI = function(palette, div){
    var obj = ColorPalette.createBrushSelectorUI(palette);
    div.appendChild(obj.div);
    return obj.ui;
};


ColorPalette.DEFAULT = new ColorPalette("default",
        new Color("blank", "#FFFFFF", "#888888", "#FFFFFF"), //Blank
        new Color("space", "#FFFFFF", "#999999", "#FFFFFF"), //Space
        new Color("black", "#000000", "#000000", "#FFFFFF"));






var ColorSelectorUI = function(palette, editable, selectMultiple){
    ColorSelectorUI.NUMBER = ColorSelectorUI.NUMBER ? ColorSelectorUI.NUMBER + 1 : 1;

    var id = "selector" + ColorSelectorUI.NUMBER + "_ui"; //palette.getName() + "_selectorUI";
    var colorUIs = [];
    var divElem = null;
    var that = this;
    
    
    
    var write = function(){
        document.write("<div id=\"" + id + "_div\"></div>");
        divElem = document.getElementById(id + "_div");
        that.refresh();
    };
    
    
    
    var appendToElement = function(element){
        if(!divElem && !(divElem = document.getElementById(id + "_div"))){
            divElem = document.createElement("div");
            divElem.id = id + "_div";
        }
        element.appendChild(divElem);
        that.refresh();
    };
    
    
    
    var refresh = function(){
        if(!divElem){
            throw "Div element has not been initialised for " + id + " ColorSelectorUI";
        } else {
            var o = document.getElementById(id + "_div"); 
            
            if(o && divElem !== o) {
                // If the user invoked .write somewhere, then
                // the element we are refering to will be different
                // than the element in the document.
                o.parentElement && o.parentElement.replaceChild(divElem, o);
            }
        }
        
        divElem.style.border = "2px ridge #BBBBBB";
        divElem.style.overflow = "auto";
        divElem.style.overflowX = "none";
        
        if(!divElem.getChildById){
            divElem.getChildById = function(id){
                for(var i = 0; i < this.children.length; i++){
                    if(this.children[i].id === id){
                        return this.children[i];
                    }
                }
            };
        }
        
        var innerDiv = divElem.getChildById(id + "_div_inner");
        if(!innerDiv){
            innerDiv = document.createElement("div");
            innerDiv.id = id + "_div_inner";
            divElem.appendChild(innerDiv);
        }
        if(!innerDiv.getChildById){
            innerDiv.getChildById = function(id){
                for(var i = 0; i < this.children.length; i++){
                    if(this.children[i].id === id){
                        return this.children[i];
                    }
                }
            };
        }
        
        var paletteColors = palette.getColors();
        for(var i = 0; i < paletteColors.length; i++){
            if(!colorUIs[i]){
                colorUIs[i] = new ColorUI(paletteColors[i], editable, true); //Plain display ColorUI
                colorUIs[i].appendToElement(innerDiv);
                
                colorUIs[i].getDiv().onclick = (function(num){ return function(){
                    that.selectColor(num);
                }; })(i);
                colorUIs[i].ondelete = (function (num){ return function(){
                    palette.removeColor(palette.getColor(num));
                    that.refresh();
                }; })(i);
                
                innerDiv.style.height += colorUIs[i].getDiv().offsetHeight;
            }
            var d = colorUIs[i].getDiv();
            d.style.borderWidth = 1;
            if(colorUIs[i].isSelected()){
                d.style.backgroundColor = "#FFFF00"; //["#BBBBBB", "#E0E0E0"][i % 2]
                d.style.borderColor = "#AAAAAA";
                d.style.borderStyle = "dotted"; //"solid";
            } else {
                d.style.backgroundColor = ["#BBBBBB", "#E0E0E0"][i % 2]
                d.style.borderColor = d.style.backgroundColor;
                d.style.borderStyle = "solid";
            }
            console.log("update cell svg ListUI");
            Nonogram.updateCellSVG(colorUIs[i].getSVG(), palette, i);
            colorUIs[i].setEditable(editable);
            colorUIs[i].setColor(paletteColors[i]);
        }
        //Remove additional Color UIs. 
        while(colorUIs.length > i){
            innerDiv.removeChild(colorUIs[colorUIs.length - 1].getDiv());
            colorUIs.pop();
        }
        
        //The 'add' button, if we need it.
        var addColorDiv = innerDiv.getChildById(id + "_add_col_div");
        if(editable){
            if(!addColorDiv){
                addColorDiv = document.createElement("div");
                addColorDiv.id = id + "_add_col_div";
                addColorDiv.style.textAlign = "center";
                
                var addBtn = document.createElement("input");
                addBtn.type = "button";
                addBtn.value = "Add Color";
                addBtn.style.padding = "5px";
                addBtn.onclick = function(){
                    palette.addColor(new Color("new color", "#FFFFFF", "#000000", "#888888", editable));
                    that.refresh();
                };
                addColorDiv.appendChild(addBtn);
            } else {
                innerDiv.removeChild(addColorDiv);
            }
            innerDiv.appendChild(addColorDiv);
            addColorDiv.style.backgroundColor = ["#BBBBBB", "#E0E0E0"][colorUIs.length % 2];
        } else {
            if(addColorDiv){
                innerDiv.removeChild(addColorDiv);
            }
        }
    };
    
    
    
    var getDivElement = function(){
        return divElement;
    };
    
    
    
    var selectColor = function(num){
        if(selectMultiple){
            colorUIs[num].setSelected(!colorUIs[num].isSelected());
        } else {
            for(var i = 0; i < colorUIs.length; i++){
                colorUIs[i].setSelected(false);
            }
            colorUIs[num].setSelected(true);
        }
        that.refresh();
    };
    
    
    
    /**
     * Returns an array of all the indices that are
     * selected from the palette
     */
    var getSelection = function(){
        var tmp = [];
        for(var i = 0; i < colorUIs.length; i++){
            if(colorUIs[i].isSelected()){
                tmp.push(i);
            }
        }
        return tmp;
    };
    
    
    
    /**
     * Returns an array of all the colors that are
     * selected from the palette
     */
    var getSelectedColors = function(){
        return that.getSelection().map(function(c){ return palette.getColor(c); });
    };
    
    
    
    /**
     * Gets the first selected color.
     */
    var getSelectedColor = function(){
        return palette.getColor(that.getSelection()[0]);
    };
    
    
    
    /**
     * Gets the first selected color.
     */
    var getSelectedIndex = function(){
        return that.getSelection()[0];
    };
    
    
    //Set methods
    this.setPalette = function(p){ palette = p; that.refresh(); };
    this.getPalette = function(){ return palette; };
    
    this.setEditable = function(b){ editable = b; that.refresh(); return that; };
    this.isEditable = function(){ return editable; };
    
    this.setSelectMultiple = function(b){ selectMultiple = b; };
    this.isSelectMultiple = function(){ return selectMultiple; };

    this.write = write;
    this.appendToElement = appendToElement;
    this.refresh = refresh;
    this.getDivElement = getDivElement;
    this.selectColor = selectColor;
    this.getSelection = getSelection;
    this.getSelectedColors = getSelectedColors;
    this.getSelectedColor = getSelectedColor;
    this.getSelectedIndex = getSelectedIndex;
};