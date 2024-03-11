
function test(arg_1, arg_2, ...args){
    console.log(arg_1);
    console.log(arg_2);
    console.log(args);
}

test(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

test(1,2, [3,4]);

test(1 ,2,3);