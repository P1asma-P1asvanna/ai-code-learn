"""turtle แบบย่อสำหรับ AI Code Learn — วาดภาพด้วยโค้ด Python ในเบราว์เซอร์

ใช้ชื่อฟังก์ชันและทิศทางเหมือน turtle มาตรฐานของ Python (จุดกลางภาพคือ (0, 0), หัวเต่าเริ่มต้นหันไปทางขวา,
left = หมุนทวนเข็มนาฬิกา) แต่ไม่ได้เปิดหน้าต่างจริง: คำสั่งวาดถูกเก็บเป็นรายการ แล้วหน้าเว็บนำไปวาดลงผืนผ้าใบ
(ใช้ได้ทั้งแบบ `import turtle` / `from turtle import *` / `t = turtle.Turtle()`)
ไฟล์นี้ใช้เฉพาะ standard library และรันได้ทั้งใน Pyodide และ Python ปกติ (มีเทสต์ใน backend/tests)
"""

import json as _json
import math as _math

MAX_COMMANDS = 20000

_commands = []
_cursors = []
_state = {"bg": None, "truncated": False}
_turtles = []


def _add(command, at=None):
    if len(_commands) >= MAX_COMMANDS:
        _state["truncated"] = True
        return
    if at is None:
        _commands.append(command)
    else:
        _commands.insert(at, command)


def _color_text(value):
    if isinstance(value, (tuple, list)) and len(value) == 3:
        r, g, b = value
        if max(r, g, b) <= 1:
            r, g, b = r * 255, g * 255, b * 255
        return "rgb(%d,%d,%d)" % (int(r), int(g), int(b))
    return str(value)


class Turtle:
    def __init__(self):
        self.x = 0.0
        self.y = 0.0
        self.heading = 0.0
        self.pen = True
        self.pen_color = "black"
        self.fill_color = "black"
        self.width = 1
        self.shown = True
        self._fill_start = None
        self._fill_points = []
        _turtles.append(self)

    # ---- เคลื่อนที่ ----
    def _go(self, nx, ny):
        if self.pen:
            _add({"t": "line", "x1": self.x, "y1": self.y, "x2": nx, "y2": ny, "c": self.pen_color, "w": self.width})
        self.x, self.y = nx, ny
        if self._fill_start is not None:
            self._fill_points.append((nx, ny))

    def forward(self, distance):
        rad = _math.radians(self.heading)
        self._go(self.x + distance * _math.cos(rad), self.y + distance * _math.sin(rad))

    def backward(self, distance):
        self.forward(-distance)

    def left(self, angle):
        self.heading = (self.heading + angle) % 360

    def right(self, angle):
        self.left(-angle)

    def goto(self, x, y=None):
        if y is None:
            x, y = x
        self._go(float(x), float(y))

    def setx(self, x):
        self.goto(x, self.y)

    def sety(self, y):
        self.goto(self.x, y)

    def setheading(self, angle):
        self.heading = angle % 360

    def home(self):
        self.goto(0, 0)
        self.heading = 0.0

    def circle(self, radius, extent=360, steps=None):
        frac = abs(extent) / 360.0
        if steps is None:
            steps = 1 + int(min(11 + abs(radius) / 6.0, 59.0) * frac)
        w = 1.0 * extent / steps
        w2 = 0.5 * w
        length = 2.0 * radius * _math.sin(_math.radians(w2))
        if radius < 0:
            length, w, w2 = -length, -w, -w2
        self.left(w2)
        for _ in range(steps):
            self.forward(length)
            self.left(w)
        self.right(w2)

    def dot(self, size=None, color=None):
        size = max(self.width + 4, self.width * 2) if size is None else size
        _add({"t": "dot", "x": self.x, "y": self.y, "r": size / 2.0, "c": _color_text(color) if color else self.pen_color})

    def write(self, text, move=False, align="left", font=None):
        size = 12
        if isinstance(font, (tuple, list)) and len(font) > 1 and isinstance(font[1], (int, float)):
            size = font[1]
        _add({"t": "text", "x": self.x, "y": self.y, "s": str(text)[:200], "c": self.pen_color, "size": size, "align": str(align)})

    # ---- ปากกา ----
    def penup(self):
        self.pen = False

    def pendown(self):
        self.pen = True

    def isdown(self):
        return self.pen

    def pensize(self, width=None):
        if width is None:
            return self.width
        self.width = max(0.1, float(width))

    def pencolor(self, *args):
        if not args:
            return self.pen_color
        self.pen_color = _color_text(args[0] if len(args) == 1 else args)

    def fillcolor(self, *args):
        if not args:
            return self.fill_color
        self.fill_color = _color_text(args[0] if len(args) == 1 else args)

    def color(self, *args):
        if not args:
            return self.pen_color, self.fill_color
        if len(args) == 2:
            self.pencolor(args[0])
            self.fillcolor(args[1])
        else:
            self.pencolor(*args)
            self.fillcolor(*args)

    def begin_fill(self):
        self._fill_start = len(_commands)
        self._fill_points = [(self.x, self.y)]

    def end_fill(self):
        if self._fill_start is not None and len(self._fill_points) >= 3:
            at = min(self._fill_start, len(_commands))
            _add({"t": "poly", "pts": [[px, py] for px, py in self._fill_points], "c": self.fill_color}, at)
        self._fill_start = None
        self._fill_points = []

    def hideturtle(self):
        self.shown = False

    def showturtle(self):
        self.shown = True

    def speed(self, value=None):
        return 0  # วาดทันที ไม่มีแอนิเมชัน

    def clear(self):
        del _commands[:]

    def reset(self):
        self.clear()
        self.x = self.y = 0.0
        self.heading = 0.0
        self.pen = True

    # ---- อ่านค่า ----
    def position(self):
        return (self.x, self.y)

    def xcor(self):
        return self.x

    def ycor(self):
        return self.y

    def heading_(self):
        return self.heading

    def distance(self, x, y=None):
        if y is None:
            x, y = x
        return _math.hypot(x - self.x, y - self.y)

    def towards(self, x, y=None):
        if y is None:
            x, y = x
        return _math.degrees(_math.atan2(y - self.y, x - self.x)) % 360

    # ชื่อสั้นเหมือน turtle มาตรฐาน
    fd = forward
    bk = back = backward
    lt = left
    rt = right
    setpos = setposition = goto
    seth = setheading
    pu = up = penup
    pd = down = pendown
    width_ = pensize
    ht = hideturtle
    st = showturtle


class _Screen:
    def bgcolor(self, *args):
        if args:
            _state["bg"] = _color_text(args[0] if len(args) == 1 else args)

    def title(self, *args):
        pass

    def setup(self, *args, **kwargs):
        pass

    def tracer(self, *args, **kwargs):
        pass

    def update(self):
        pass

    def delay(self, *args):
        pass

    def exitonclick(self):
        pass

    def mainloop(self):
        pass

    def clear(self):
        del _commands[:]
        _state["bg"] = None

    clearscreen = clear

    def colormode(self, *args):
        pass


_screen = _Screen()
_default = Turtle()


def Screen():
    return _screen


def _delegate(name):
    def call(*args, **kwargs):
        return getattr(_default, name)(*args, **kwargs)

    call.__name__ = name
    return call


_FUNCS = [
    "forward", "backward", "left", "right", "goto", "setx", "sety", "setheading", "home", "circle", "dot", "write",
    "penup", "pendown", "isdown", "pensize", "pencolor", "fillcolor", "color", "begin_fill", "end_fill",
    "hideturtle", "showturtle", "speed", "clear", "reset", "position", "xcor", "ycor", "distance", "towards",
    "fd", "bk", "back", "lt", "rt", "setpos", "setposition", "seth", "pu", "up", "pd", "down", "ht", "st",
]
for _name in _FUNCS:
    globals()[_name] = _delegate(_name)

width = pensize
heading = _delegate("heading_")
bgcolor = _screen.bgcolor
title = _screen.title
setup = _screen.setup
tracer = _screen.tracer
update = _screen.update
delay = _screen.delay
exitonclick = _screen.exitonclick
mainloop = _screen.mainloop
done = _screen.mainloop
colormode = _screen.colormode
clearscreen = _screen.clear

__all__ = ["Turtle", "Screen"] + _FUNCS + [
    "width", "heading", "bgcolor", "title", "setup", "tracer", "update", "delay", "exitonclick", "mainloop", "done",
    "colormode", "clearscreen",
]


# ---- ส่วนที่ตัวรันของเว็บเรียกใช้ (ไม่ใช่ API สำหรับผู้เรียน) ----

def _reset_all():
    del _commands[:]
    del _cursors[:]
    _state["bg"] = None
    _state["truncated"] = False
    del _turtles[1:]
    _default.x = _default.y = 0.0
    _default.heading = 0.0
    _default.pen = True
    _default.pen_color = "black"
    _default.fill_color = "black"
    _default.width = 1
    _default.shown = True
    _default._fill_start = None
    _default._fill_points = []


def _take():
    """คืน JSON ของภาพที่วาด (หรือ None ถ้าไม่มีอะไรให้วาด)"""
    if not _commands and _state["bg"] is None:
        return None
    cursors = [
        {"x": t.x, "y": t.y, "h": t.heading, "c": t.pen_color}
        for t in _turtles
        if t.shown and (t is not _default or _commands)
    ]
    return _json.dumps(
        {"commands": _commands, "bg": _state["bg"], "cursors": cursors, "truncated": _state["truncated"]},
        ensure_ascii=False,
    )
