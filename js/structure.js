export const eget = id => document.getElementById(id)?.value;

export function attach(id, fn) {
  const el = document.getElementById(id);
  if (el) el.onclick = fn;
}

export class Student {
  constructor(stdname, stdclass, teacherId, assignhw = [], finishedhw = []) {
    this.stdname = stdname;
    this.stdclass = stdclass;
    this.teacherId = teacherId;
    this.assignhw = assignhw;
    this.finishedhw = finishedhw;
  }
}

export class Classroom {
  constructor(name, teacher) {
    this.name = name;
    this.teacher = teacher;
  }
}

export class Homework {
  constructor(name, dueDate, classroom, teacherId) {
    this.name = name;
    this.dueDate = dueDate;
    this.classroom = classroom;
    this.teacher = teacherId;
  }
}

export class Teacher {
  constructor(name, email, id) {
    this.name = name;
    this.email = email;
    this.id = id;
  }
}