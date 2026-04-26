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

export const educationApi = {
  listCourses: (courseType?: string): Promise<CourseOut[]> =>
    axios.get(`${BASE}/courses`, {
      params: courseType ? { course_type: courseType } : {},
    }).then((data: any) => data.courses ?? data),

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
};
