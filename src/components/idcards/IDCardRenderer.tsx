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

function renderElementContent(el: IDCardElement, layout: IDCardLayout, student?: any) {
  if (el.type === "text") {
    if (!student) return el.templateField || el.label || "";
    const v = resolveElementValue(layout, student, el);
    return v || "";
  }

  // photo / logo
  if (!student) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
        {el.type.toUpperCase()}
      </div>
    );
  }

  const url = resolveElementValue(layout, student, el);
  if (!url) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
        {el.type.toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="w-full h-full"
      style={{ objectFit: el.type === "photo" ? "cover" : "contain" }}
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


