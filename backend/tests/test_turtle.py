"""ทดสอบ turtle แบบย่อ (frontend/public/workers/turtle.py) ด้วย Python ปกติ — ไฟล์นี้ใช้เฉพาะ standard library
ตัวจริงรันใน Pyodide ในเบราว์เซอร์ผู้เรียน แต่ตรรกะเหมือนกัน"""

import importlib.util
import json
import math
import pathlib
import unittest

PATH = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "public" / "workers" / "turtle.py"


def load():
    spec = importlib.util.spec_from_file_location("turtle_under_test", PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module._reset_all()
    return module


def take(module):
    raw = module._take()
    return None if raw is None else json.loads(raw)


class TurtleTests(unittest.TestCase):
    def setUp(self):
        self.t = load()

    def test_nothing_drawn_returns_none(self):
        self.assertIsNone(take(self.t))

    def test_forward_and_turn_draw_lines(self):
        self.t.forward(100)
        self.t.left(90)
        self.t.forward(50)
        drawing = take(self.t)
        lines = [c for c in drawing["commands"] if c["t"] == "line"]
        self.assertEqual(len(lines), 2)
        self.assertAlmostEqual(lines[0]["x2"], 100)
        self.assertAlmostEqual(lines[1]["y2"], 50)  # left = ทวนเข็ม (หันขึ้น)
        self.assertEqual(len(drawing["cursors"]), 1)

    def test_penup_moves_without_drawing(self):
        self.t.penup()
        self.t.goto(50, 50)
        self.t.pendown()
        self.t.forward(10)
        lines = [c for c in take(self.t)["commands"] if c["t"] == "line"]
        self.assertEqual(len(lines), 1)
        self.assertAlmostEqual(lines[0]["x1"], 50)

    def test_square_closes(self):
        for _ in range(4):
            self.t.forward(80)
            self.t.right(90)
        self.assertAlmostEqual(self.t.xcor(), 0, places=6)
        self.assertAlmostEqual(self.t.ycor(), 0, places=6)

    def test_circle_returns_to_start(self):
        self.t.circle(50)
        self.assertAlmostEqual(self.t.xcor(), 0, places=6)
        self.assertAlmostEqual(self.t.ycor(), 0, places=6)

    def test_fill_polygon_is_inserted_before_outline(self):
        self.t.fillcolor("red")
        self.t.begin_fill()
        for _ in range(3):
            self.t.forward(60)
            self.t.left(120)
        self.t.end_fill()
        kinds = [c["t"] for c in take(self.t)["commands"]]
        self.assertEqual(kinds[0], "poly")
        self.assertEqual(kinds.count("line"), 3)

    def test_colors_and_background(self):
        self.t.color("blue", "yellow")
        self.t.bgcolor("black")
        self.t.forward(10)
        drawing = take(self.t)
        self.assertEqual(drawing["bg"], "black")
        self.assertEqual(drawing["commands"][0]["c"], "blue")
        self.t.pencolor((1, 0, 0))
        self.assertEqual(self.t._default.pen_color, "rgb(255,0,0)")

    def test_dot_and_write(self):
        self.t.dot(20, "green")
        self.t.write("สวัสดี", font=("Arial", 18))
        commands = take(self.t)["commands"]
        self.assertEqual(commands[0]["t"], "dot")
        self.assertEqual(commands[0]["r"], 10)
        self.assertEqual(commands[1]["s"], "สวัสดี")
        self.assertEqual(commands[1]["size"], 18)

    def test_module_level_functions_share_the_default_turtle(self):
        self.t.forward(30)
        self.t.fd(30)
        self.assertAlmostEqual(self.t.xcor(), 60)
        self.assertAlmostEqual(self.t.heading(), 0)

    def test_star_import_exposes_the_usual_names(self):
        for name in ("forward", "left", "right", "penup", "pendown", "goto", "circle", "color", "begin_fill", "end_fill", "done", "Screen", "Turtle", "bgcolor", "speed", "hideturtle"):
            self.assertIn(name, self.t.__all__)
            self.assertTrue(callable(getattr(self.t, name)), name)

    def test_multiple_turtles_and_screen_object(self):
        other = self.t.Turtle()
        other.color("red")
        other.forward(20)
        self.t.Screen().bgcolor("pink")
        drawing = take(self.t)
        self.assertEqual(drawing["bg"], "pink")
        self.assertEqual(len(drawing["cursors"]), 2)  # เต่าตัวเริ่มต้นกับเต่าตัวใหม่

    def test_hideturtle_removes_cursor(self):
        self.t.forward(10)
        self.t.hideturtle()
        self.assertEqual(take(self.t)["cursors"], [])

    def test_command_limit_marks_truncated(self):
        for _ in range(self.t.MAX_COMMANDS + 50):
            self.t.forward(1)
        drawing = take(self.t)
        self.assertEqual(len(drawing["commands"]), self.t.MAX_COMMANDS)
        self.assertTrue(drawing["truncated"])

    def test_reset_all_clears_everything_between_runs(self):
        self.t.bgcolor("red")
        self.t.Turtle().forward(5)
        self.t.forward(5)
        self.t._reset_all()
        self.assertIsNone(take(self.t))
        self.assertEqual(self.t.position(), (0.0, 0.0))

    def test_output_is_valid_json_with_nonfinite_values_avoided(self):
        self.t.forward(10 ** 6)
        drawing = take(self.t)
        self.assertTrue(math.isfinite(drawing["commands"][0]["x2"]))

    def test_grading_helpers_count_lines_and_length(self):
        self.t.penup()
        self.t.forward(10)  # ยกปากกา: ไม่นับ
        self.t.pendown()
        for _ in range(4):
            self.t.forward(50)
            self.t.left(90)
        self.assertEqual(self.t.lines_drawn(), 4)
        self.assertEqual(round(self.t.path_length()), 200)
        self.assertIn("lines_drawn", self.t.__all__)


if __name__ == "__main__":
    unittest.main()
