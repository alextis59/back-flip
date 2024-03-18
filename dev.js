class Test {
    constructor() {
        this.name = 'dev';
    }
    printName() {
        console.log(this.name);
    }
}

class Test2 extends Test {
    constructor() {
        super();
        this.name = 'dev2';
    }

    printName() {
        console.log(this.name + " test");
    }
}

const test = new Test();

test.printName();

const test2 = new Test2();

test2.printName();