export interface Chapter {
  id: string;
  courseId?: string;
  title: string;
  description?: string;
  duration?: number;
  videoUrl?: string;
  orderIndex?: number;
  progress?: number;
  isCompleted?: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: 'theory' | 'practice';
  duration: number;
  instructor?: string;
  rating?: number;
  studentsCount?: number;
  tags?: string[];
  chapters?: Chapter[];
  progress?: number;
  thumbnail?: string;
}

export interface LearningStats {
  total_courses: number;
  total_students: number;
  average_rating: number;
  total_duration: number;
}

export interface CourseProgress {
  course_id: string;
  progress: number;
  completed_chapters: number;
  total_chapters: number;
}

export interface UserProgressStats {
  total_courses: number;
  completed_courses: number;
  total_learning_time: number;
  courses_progress: CourseProgress[];
}

export interface GuidedStep {
  id: string;
  title: string;
  description: string;
  instructions?: string;
  focus_element?: string;
  order_index?: number;
}
