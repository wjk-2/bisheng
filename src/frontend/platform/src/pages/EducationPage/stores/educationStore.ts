import { create } from 'zustand';
import { educationAPI } from '@/controllers/API/education';
import type { Course, LearningStats, UserProgressStats, GuidedStep } from '../types';

interface EducationStore {
  // 课程列表
  courses: Course[];
  coursesLoading: boolean;
  fetchCourses: (level?: string, category?: string) => Promise<void>;

  // 当前课程
  currentCourse: Course | null;
  courseLoading: boolean;
  fetchCourseDetail: (courseId: string) => Promise<void>;
  clearCurrentCourse: () => void;

  // 学习统计
  learningStats: LearningStats;
  fetchLearningStats: () => Promise<void>;

  // 用户进度
  userProgress: UserProgressStats | null;
  progressLoading: boolean;
  fetchUserProgress: () => Promise<void>;

  // 引导步骤
  guidedSteps: GuidedStep[];
  stepsLoading: boolean;
  fetchGuidedSteps: () => Promise<void>;
}

const defaultLearningStats: LearningStats = {
  total_courses: 0,
  total_students: 0,
  average_rating: 0,
  total_duration: 0,
};

export const useEducationStore = create<EducationStore>()((set) => ({
  // 课程列表
  courses: [],
  coursesLoading: false,
  fetchCourses: async (level, category) => {
    set({ coursesLoading: true });
    try {
      const response = await educationAPI.course.getCourses({ level, category });
      set({ courses: response.courses || [], coursesLoading: false });
    } catch {
      set({ courses: [], coursesLoading: false });
    }
  },

  // 当前课程
  currentCourse: null,
  courseLoading: false,
  fetchCourseDetail: async (courseId: string) => {
    set({ courseLoading: true });
    try {
      const data = await educationAPI.course.getCourseDetail(courseId);
      set({ currentCourse: data, courseLoading: false });
    } catch {
      set({ currentCourse: null, courseLoading: false });
    }
  },
  clearCurrentCourse: () => set({ currentCourse: null }),

  // 学习统计
  learningStats: defaultLearningStats,
  fetchLearningStats: async () => {
    try {
      const stats = await educationAPI.stats.getLearningStats();
      set({ learningStats: stats });
    } catch {
      // 保持默认值
    }
  },

  // 用户进度
  userProgress: null,
  progressLoading: false,
  fetchUserProgress: async () => {
    set({ progressLoading: true });
    try {
      const data = await educationAPI.progress.getUserProgress();
      set({ userProgress: data, progressLoading: false });
    } catch {
      set({ userProgress: null, progressLoading: false });
    }
  },

  // 引导步骤
  guidedSteps: [],
  stepsLoading: false,
  fetchGuidedSteps: async () => {
    set({ stepsLoading: true });
    try {
      const data = await educationAPI.guidedBuilder.getSteps();
      set({ guidedSteps: data?.steps ?? [], stepsLoading: false });
    } catch {
      set({ guidedSteps: [], stepsLoading: false });
    }
  },
}));
