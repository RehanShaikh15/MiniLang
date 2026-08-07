// MiniLang Sample Program
int x = 10;
int y = 5;

func add(a: int, b: int) -> int {
    return a + b;
}

func main() -> void {
    int sum = add(x, y);
    print("The sum is:");
    print(sum);
    
    if (sum > 10) {
        print("Sum is greater than 10");
    } else {
        print("Sum is 10 or less");
    }
}
