// 使用项目封装的 customAxios 实例（带 interceptor，response 已解包 data.data）
import axios from '@/controllers/request';

const BASE = '/api/v1/education';

export interface CourseOut {
  id: number;
  title: string;
  type: string;
  description: string | null;
  cover: string | null;
  total_units: number;
  completed_units: number;
}

export interface UnitOut {
  id: number;
  course_id: number;
  title: string;
  order: number;
  estimated_minutes: number;
  right_panel_type: string;
  right_panel_config: Record<string, unknown> | null;
  is_completed: boolean;
}

export interface CourseDetailOut {
  course: CourseOut;
  units: UnitOut[];
}

export interface UnitDetailOut extends UnitOut {
  content: string | null;
}

export interface UnitLearningOut {
  unit: UnitDetailOut;
  prev_unit_id: number | null;
  next_unit_id: number | null;
}

export interface ClassOut {
  id: number;
  name: string;
  semester: string;
  teacher_id: number;
  status: number;
  member_count: number;
  create_time: string | null;
}

export interface ClassMemberOut {
  student_id: number;
  username: string;
  join_time: string | null;
}

export interface ClassDetailOut {
  class_info: ClassOut;
  members: ClassMemberOut[];
}

export interface PortfolioOut {
  id: number;
  unit_id: number;
  class_id: number | null;
  asset_type: string;
  title: string;
  text_content: string | null;
  submit_time: string | null;
}

export const educationApi = {
  listCourses: (courseType?: string): Promise<CourseOut[]> =>
    axios.get(`${BASE}/courses`, {
      params: courseType ? { course_type: courseType } : {},
    }).then((data: { courses: CourseOut[] }) => data.courses),

  getCourseDetail: (courseId: number, classId?: number): Promise<CourseDetailOut> =>
    axios.get(`${BASE}/courses/${courseId}`, {
      params: classId ? { class_id: classId } : {},
    }).then((data: any) => data),

  getUnitLearning: (unitId: number, classId?: number): Promise<UnitLearningOut> =>
    axios.get(`${BASE}/units/${unitId}`, {
      params: classId ? { class_id: classId } : {},
    }).then((data: any) => data),

  markUnitComplete: (unitId: number, classId: number): Promise<unknown> =>
    axios.post(`${BASE}/units/${unitId}/complete`, { class_id: classId })
      .then((data: any) => data),

  // 班级（教师端）
  createClass: (name: string, semester: string): Promise<ClassOut> =>
    axios.post(`${BASE}/classes`, { name, semester }).then((d: any) => d),

  listClasses: (): Promise<ClassOut[]> =>
    axios.get(`${BASE}/classes`).then((d: { classes: ClassOut[] }) => d.classes),

  getClassDetail: (classId: number): Promise<ClassDetailOut> =>
    axios.get(`${BASE}/classes/${classId}`).then((d: any) => d),

  addMember: (classId: number, studentId: number): Promise<void> =>
    axios.post(`${BASE}/classes/${classId}/members`, { student_id: studentId }),

  removeMember: (classId: number, studentId: number): Promise<void> =>
    axios.delete(`${BASE}/classes/${classId}/members/${studentId}`),

  // 班级（学生端）
  listMyClasses: (): Promise<ClassOut[]> =>
    axios.get(`${BASE}/my-classes`).then((d: { classes: ClassOut[] }) => d.classes),

  // 作品集
  submitPortfolio: (req: {
    unit_id: number;
    class_id?: number;
    title: string;
    text_content: string;
  }): Promise<PortfolioOut> =>
    axios.post(`${BASE}/portfolio`, req).then((d: any) => d),

  listPortfolioByUnit: (unitId: number): Promise<PortfolioOut[]> =>
    axios.get(`${BASE}/portfolio/units/${unitId}`).then((d: { items: PortfolioOut[] }) => d.items),
};
