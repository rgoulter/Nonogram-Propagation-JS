/**
 * Examples for making use of the Nonogram solver.
 */

var example_solution =  [[1,1,1,1,1,1,1,1,1,1,2,2,2,1,1,1,1,1,1,1],
                         [1,1,1,1,1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,1],
                         [1,1,1,1,1,1,1,1,1,2,2,2,1,2,1,1,1,1,1,1],
                         [1,1,1,1,1,1,1,1,1,2,2,1,1,2,1,1,1,1,1,1],
                         [1,1,1,1,1,1,2,2,2,1,2,2,2,1,2,2,2,2,1,1],
                         [1,1,1,1,2,2,1,1,2,2,1,1,1,2,2,2,2,2,2,2],
                         [1,1,2,2,2,2,2,2,1,2,1,1,1,2,1,1,1,1,1,1],
                         [1,2,2,2,2,1,1,1,2,2,1,1,2,2,1,1,1,1,1,1],
                         [1,1,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,1,1],
                         [1,1,1,1,1,1,1,2,2,2,1,1,2,1,1,1,1,1,1,1],
                         [1,1,1,1,1,1,1,2,2,2,2,2,2,1,1,1,1,1,1,1],
                         [1,2,2,1,1,1,2,2,2,2,2,2,2,1,1,1,1,1,1,1],
                         [2,2,2,2,2,2,1,1,2,2,2,1,2,1,1,1,1,1,1,1],
                         [2,1,2,2,1,1,2,2,1,2,1,1,2,1,1,1,1,1,1,1],
                         [1,1,1,2,2,2,2,1,1,2,1,2,1,1,2,2,2,1,1,1],
                         [1,1,1,1,1,1,1,1,2,2,2,2,1,2,2,1,2,2,1,1],
                         [1,1,1,1,1,1,1,1,2,2,2,1,1,2,2,2,1,2,1,1],
                         [1,1,1,1,1,1,1,2,2,2,1,1,1,1,2,2,2,1,1,1],
                         [1,1,1,1,1,1,2,2,2,1,1,1,1,1,1,1,1,1,1,1],
                         [1,1,1,1,1,1,2,2,1,2,1,1,1,1,1,1,1,1,1,1]];

var example_color_solution =   [[1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,1],
                                [1,1,1,1,1,1,1,1,3,3,1,1,2,2,2,2,1,1,1,1],
                                [1,1,1,1,1,1,1,3,3,1,1,1,2,2,2,2,1,1,1,1],
                                [1,1,1,1,1,1,3,3,1,1,1,1,1,2,2,1,1,1,1,1],
                                [1,1,1,1,1,1,3,1,1,1,1,1,2,2,2,2,1,1,1,1],
                                [1,1,1,1,1,3,3,1,1,1,1,1,2,2,2,2,1,1,1,1],
                                [1,1,1,1,1,3,3,1,1,1,1,1,2,2,2,2,1,1,1,1],
                                [1,1,1,1,1,3,1,1,1,1,1,1,2,2,2,2,1,1,1,1],
                                [1,1,1,1,1,3,1,1,1,1,1,1,2,2,2,2,1,1,1,1],
                                [1,1,1,1,1,3,1,1,1,1,1,1,2,2,2,2,1,1,1,1],
                                [1,1,1,1,3,3,1,1,1,1,1,2,2,2,2,2,2,1,1,1],
                                [1,1,1,1,3,3,1,1,1,1,2,2,2,2,2,2,2,1,1,1],
                                [1,1,1,1,3,1,1,1,1,1,2,2,1,2,2,2,2,2,1,1],
                                [1,1,1,1,3,1,1,1,1,2,2,1,2,2,2,2,2,2,2,1],
                                [4,4,4,4,4,4,4,1,1,2,1,2,2,2,2,2,2,2,2,1],
                                [4,4,4,4,4,4,4,1,2,2,1,2,2,2,2,2,2,2,2,2],
                                [4,4,4,4,4,4,4,1,2,2,2,2,2,2,2,2,2,2,2,2],
                                [4,4,4,4,4,4,4,1,2,2,2,2,2,2,2,2,2,2,2,2],
                                [4,4,4,4,4,4,4,1,5,5,5,5,5,5,5,5,2,2,2,2],
                                [4,4,4,4,4,4,4,1,5,5,5,5,5,5,5,5,2,2,2,2],
                                [4,4,4,4,4,4,4,1,5,5,5,5,5,5,5,5,2,2,2,2],
                                [1,4,4,4,4,4,1,1,5,5,5,5,5,5,5,5,2,2,2,2],
                                [1,1,4,4,4,1,1,1,5,5,5,5,5,5,5,5,2,2,2,2],
                                [1,1,1,4,1,1,1,1,5,5,5,5,5,5,5,5,2,2,2,2],
                                [1,1,1,4,1,1,1,1,5,5,5,5,5,5,5,5,2,2,2,2],
                                [1,1,1,4,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2],
                                [1,1,1,4,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2],
                                [1,1,1,4,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2],
                                [1,1,4,4,4,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2],
                                [1,4,4,4,4,4,1,1,1,2,2,2,2,2,2,2,2,2,2,1]];

var example_simple_color_solution = [[2,2,1,1,5],
                                     [1,1,3,3,2],
                                     [1,1,1,1,1],
                                     [1,5,1,3,5],
                                     [2,3,2,1,1]];

var example_solution_small = [[1,2,2,1,1],
                              [1,2,2,1,2],
                              [1,1,2,1,2],
                              [1,2,2,2,1],
                              [2,1,2,1,1],
                              [2,1,2,1,1],
                              [1,1,2,2,1],
                              [1,2,1,2,1],
                              [1,2,1,2,2],
                              [2,2,1,1,1]];
        
//For Black and While clues.
function toClueRep(arr){
    return {row: arr["row"].map(function(row){ return row.map(function(c){ return new Clue(2, c)}); }),
            col: arr["col"].map(function(col){ return col.map(function(c){ return new Clue(2, c)}); })};
}
var cat_clues_simple =
{ row: [[2], [2], [1], [1], [1, 3],
        [2, 5], [1, 7, 1, 1], [1, 8, 2, 2], [1, 9, 5], [2, 16],
        [1, 17], [7, 11], [5, 5, 3], [5, 4], [3, 3],
        [2, 2], [2, 1], [1, 1], [2, 2], [2, 2]],
  col: [[5], [5, 3], [2, 3, 4], [1, 7, 2], [8],
        [9], [9], [8], [7], [8],
        [9], [10], [13], [6, 2], [4],
        [6], [6], [5], [6], [6]] };
var cat_clues = toClueRep(cat_clues_simple);

var chess_clues_simple = 
{ row: [[1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1]],
  col: [[1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1]]};
var chess_clues = toClueRep(chess_clues_simple);

var forever_clues_simple = { row: [[1, 2, 2, 2, 2, 2, 1], [1, 2, 2, 2, 2, 2, 1, 1], [1, 1], [1, 1], [1, 3, 1],
                            [1, 13, 1], [1, 13, 1], [1, 13, 1], [1, 4, 4, 1], [1, 4, 3, 4, 1],
                            [1, 4, 5, 4, 1], [1, 7, 1], [1, 7, 1], [1, 7, 1], [1, 7, 1],
                            [1, 1, 5, 1], [1, 2, 6, 1], [1, 4, 6, 1], [1, 6, 6, 1], [1, 3, 1],
                            [1, 1, 1], [1, 1], [1, 1], [1, 1, 2, 2, 2, 2, 2, 1], [1, 2, 2, 2, 2, 2, 1]],
                     col: [[1, 2, 2, 2, 2, 2, 1], [1, 1, 2, 2, 2, 2, 2, 1], [1, 1], [1, 1], [1, 1],
                           [1, 2, 1], [1, 6, 1, 1], [1, 6, 2, 1], [1, 6, 3, 1], [1, 4, 8, 1],
                           [1, 3, 5, 2, 1], [1, 4, 8, 2, 1], [1, 4, 9, 2, 1], [1, 4, 11, 1], [1, 3, 9, 1],
                           [1, 4, 8, 1], [1, 6, 3, 1], [1, 6, 2, 1], [1, 6, 1, 1], [1, 2, 1],
                           [1, 1], [1, 1], [1, 1], [1, 2, 2, 2, 2, 2, 1, 1], [1, 2, 2, 2, 2, 2, 1]]};
var forever_clues = toClueRep(forever_clues_simple);



function prepareBWExample(includeSolution){
    nono.setPalette(bw_palette);
    nono.resizeTo(20,20);
    nono.setClues(example_clues);
    if(includeSolution){
        nono.setData(example_solution);
    }
    setSizeTextboxes();
}

function prepareColorExample(includeSolution){
    nono.setPalette(col_palette);
    nono.resizeTo(20,30);
    nono.setClues(example_color_clues);
    if(includeSolution){
        nono.setData(example_color_solution);
    }
    setSizeTextboxes();
}

function prepareSimpleColorExample(includeSolution){
    nono.setPalette(col_palette);
    nono.resizeTo(5,5);
    nono.setClues(example_simple_color_clues);
    if(includeSolution){
        nono.setData(example_simple_color_solution);
    }
    setSizeTextboxes();
}

function prepareSmallExample(includeSolution){
    nono.setPalette(bw_palette);
    nono.resizeTo(5,10);
    nono.setClues(example_clues_small);
    if(includeSolution){
        nono.setData(example_solution_small);
    }
    setSizeTextboxes();
}

function prepareCatExample(includeSolution){
    nono.setPalette(bw_palette);
    nono.resizeTo(20,20);
    nono.setClues(cat_clues);
    setSizeTextboxes();
}

function prepareChessExample(includeSolution){
    nono.setPalette(bw_palette);
    nono.resizeTo(10,10);
    nono.setClues(chess_clues);
    setSizeTextboxes();
}

function prepareForeverExample(includeSolution){
    nono.setPalette(bw_palette);
    nono.resizeTo(25,25);
    nono.setClues(forever_clues);
    setSizeTextboxes();
}

function prepareExample(i, includeSolution){
    return [prepareBWExample,
            prepareColorExample,
            prepareSimpleColorExample,
            prepareSmallExample,
            prepareCatExample,
            prepareChessExample,
            prepareForeverExample][i](includeSolution);
}

var bw_palette = ColorPalette.DEFAULT.clone();

//var example_colors = ["white", "white", "green", "red", "cyan", "yellow"];
var col_palette = new ColorPalette("default",
                                    new Color("white","#FFFFFF","#888888","#FFFFFF"),
                                    new Color("white","#FFFFFF","#999999","#FFFFFF"),
                                    new Color("green","green","white","green"),
                                    new Color("red","red","black","red"),
                                    new Color("cyan","cyan","black"),
                                    new Color("yellow","yellow","black"));

// We generate the clues for our examples from the solutions.
// This is easier than typing out the clues manually. :-)
var example_clues = Nonogram.generateCluesFromSolution(example_solution);
var example_color_clues = Nonogram.generateCluesFromSolution(example_color_solution);
var example_simple_color_clues = Nonogram.generateCluesFromSolution(example_simple_color_solution);
var example_clues_small = Nonogram.generateCluesFromSolution(example_solution_small);