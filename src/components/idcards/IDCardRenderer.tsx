import React from "react";
import { IDCardLayout, IDCardElement, PX_PER_MM, resolveElementValue } from "@/lib/idCardLayout";

type Props = {
  layout: IDCardLayout;
  student?: any;
  /**
   * Render height in px. If omitted, renders at real size using mm -> px.
   * Preview should pass a fixed value (e.g. 400) to keep UI consistent.
   */
  renderHeightPx?: number;
};

function getAlignStyle(align?: string) {
  if (align === "left") return { justifyContent: "flex-start", textAlign: "left" as const };
  if (align === "right") return { justifyContent: "flex-end", textAlign: "right" as const };
  return { justifyContent: "center", textAlign: "center" as const };
}

function getPhotoBorderRadius(photoShape?: string): string {
  switch (photoShape) {
    case "circle":
      return "50%";
    case "square":
      return "0";
    case "rounded":
      return "8px";
    case "rectangle":
    default:
      return "0";
  }
}

function renderElementContent(el: IDCardElement, layout: IDCardLayout, student?: any) {
  if (el.type === "text") {
    if (!student) return el.templateField || el.label || "";
    const v = resolveElementValue(layout, student, el);
    return v || "";
  }

  // photo / logo
  if (!student) {
    const borderRadius = getPhotoBorderRadius(el.photoShape);
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#e5e7eb",
          color: "#6b7280",
          fontSize: "12px",
          fontWeight: "500",
          border: "1px dashed #9ca3af",
          borderRadius: borderRadius,
        }}
      >
        {el.type.toUpperCase()}
      </div>
    );
  }

  const url = resolveElementValue(layout, student, el);
  
  // Debug logging for photo elements
  if (el.type === "photo" && student) {
    console.log(`[IDCardRenderer] Photo element resolution:`, {
      templateField: el.templateField,
      resolvedValue: url || "(empty)",
      hasResolvedFields: !!student.resolved_fields,
      resolvedFieldsPhoto: student.resolved_fields?.[el.templateField || ""],
      fieldMappings: layout.fieldMappings,
      studentPhotoUrl: student.photo_url || student.photoUrl,
      studentId: student.id,
      studentName: student.name
    });
  }
  
  if (!url) {
    const borderRadius = getPhotoBorderRadius(el.photoShape);
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#e5e7eb",
          color: "#6b7280",
          fontSize: "12px",
          fontWeight: "500",
          border: "1px dashed #9ca3af",
          borderRadius: borderRadius,
        }}
      >
        {el.type.toUpperCase()}
      </div>
    );
  }

  // Apply photoShape styles to the image
  const borderRadius = getPhotoBorderRadius(el.photoShape);
  const objectFit = el.type === "photo" ? "cover" : "contain";

  return (
    <img
      src={url}
      alt=""
      className="w-full h-full"
      style={{ 
        objectFit,
        borderRadius,
        overflow: "hidden",
      }}
      crossOrigin="anonymous"
    />
  );
}

export function IDCardRenderer({ layout, student, renderHeightPx }: Props) {
  const baseHeightPx = layout.height_mm * PX_PER_MM;
  const heightPx = renderHeightPx ?? baseHeightPx;
  const scale = baseHeightPx > 0 ? heightPx / baseHeightPx : 1;
  const widthPx = layout.width_mm * PX_PER_MM * scale;

  return (
    <div
      className="relative bg-white overflow-hidden"
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        backgroundImage: layout.backgroundImageUrl ? `url(${layout.backgroundImageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {layout.elements.map((el) => {
        const alignStyle = getAlignStyle(el.align);
        const isPhoto = el.type === "photo";
        const borderRadius = isPhoto ? getPhotoBorderRadius(el.photoShape) : undefined;
        
        return (
          <div
            key={el.id}
            className="absolute"
            style={{
              left: `${el.x_percent}%`,
              top: `${el.y_percent}%`,
              width: `${el.width_percent}%`,
              height: `${el.height_percent}%`,
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
              color: el.color || "#000000",
              fontFamily: el.fontFamily || "Arial",
              fontWeight: el.fontWeight || "normal",
              fontSize: `${(el.fontSize || 14) * scale}px`,
              borderRadius: borderRadius,
              ...alignStyle,
            }}
          >
            {renderElementContent(el, layout, student)}
          </div>
        );
      })}
    </div>
  );
}



