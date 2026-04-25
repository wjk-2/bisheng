import React, { forwardRef } from "react";
import Education from "./Education.svg?react";

export const EducationIcon = forwardRef<
    SVGSVGElement & { className: any },
    React.PropsWithChildren<{ className?: string }>
>(({ className, ...props }, ref) => {
    return <Education ref={ref} {...props} className={className || ''} />;
});





