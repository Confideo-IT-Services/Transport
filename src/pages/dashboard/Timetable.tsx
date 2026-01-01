import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Eye, Download, Clock } from "lucide-react";

const timeSlots = [
  "08:00 - 08:45",
  "08:45 - 09:30",
  "09:30 - 10:00", // Break
  "10:00 - 10:45",
  "10:45 - 11:30",
  "11:30 - 12:15",
  "12:15 - 01:00", // Lunch
  "01:00 - 01:45",
  "01:45 - 02:30",
];

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const subjects: Record<string, { name: string; color: string; teacher: string }> = {
  MATH: { name: "Mathematics", color: "bg-blue-100 text-blue-700 border-blue-200", teacher: "Mrs. Sharma" },
  ENG: { name: "English", color: "bg-green-100 text-green-700 border-green-200", teacher: "Mr. Singh" },
  HIN: { name: "Hindi", color: "bg-orange-100 text-orange-700 border-orange-200", teacher: "Mrs. Gupta" },
  SCI: { name: "Science", color: "bg-purple-100 text-purple-700 border-purple-200", teacher: "Mr. Kumar" },
  SST: { name: "Social Studies", color: "bg-yellow-100 text-yellow-700 border-yellow-200", teacher: "Mrs. Patel" },
  COMP: { name: "Computer", color: "bg-cyan-100 text-cyan-700 border-cyan-200", teacher: "Mr. Verma" },
  ART: { name: "Art", color: "bg-pink-100 text-pink-700 border-pink-200", teacher: "Mrs. Das" },
  PE: { name: "Physical Ed.", color: "bg-red-100 text-red-700 border-red-200", teacher: "Mr. Rao" },
  BREAK: { name: "Break", color: "bg-muted text-muted-foreground border-border", teacher: "" },
  LUNCH: { name: "Lunch", color: "bg-muted text-muted-foreground border-border", teacher: "" },
};

const timetableData: Record<string, string[]> = {
  Monday: ["MATH", "ENG", "BREAK", "SCI", "HIN", "SST", "LUNCH", "COMP", "ART"],
  Tuesday: ["ENG", "MATH", "BREAK", "HIN", "SCI", "COMP", "LUNCH", "SST", "PE"],
  Wednesday: ["SCI", "HIN", "BREAK", "MATH", "ENG", "ART", "LUNCH", "PE", "SST"],
  Thursday: ["HIN", "SCI", "BREAK", "ENG", "MATH", "PE", "LUNCH", "ART", "COMP"],
  Friday: ["MATH", "COMP", "BREAK", "SCI", "HIN", "ENG", "LUNCH", "SST", "ART"],
  Saturday: ["ENG", "MATH", "BREAK", "HIN", "PE", "COMP", "", "", ""],
};

export default function Timetable() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedClass, setSelectedClass] = useState("5A");
  
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Timetable</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "Create and manage weekly timetables"
                : "View your class timetable"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin ? (
              <>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1A">Class 1A</SelectItem>
                    <SelectItem value="2A">Class 2A</SelectItem>
                    <SelectItem value="3A">Class 3A</SelectItem>
                    <SelectItem value="4A">Class 4A</SelectItem>
                    <SelectItem value="5A">Class 5A</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Timetable
                </Button>
              </>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                View Only
              </Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="week" className="space-y-4">
          <TabsList>
            <TabsTrigger value="week">Weekly View</TabsTrigger>
            <TabsTrigger value="today">Today's Schedule</TabsTrigger>
          </TabsList>

          {/* Weekly Timetable */}
          <TabsContent value="week">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Class {selectedClass} - Weekly Timetable</span>
                  <Badge variant="outline">Academic Year 2024-25</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-7 gap-2">
                    {/* Header */}
                    <div className="p-3 text-center font-medium text-muted-foreground">
                      <Clock className="w-4 h-4 mx-auto mb-1" />
                      Time
                    </div>
                    {days.map((day) => (
                      <div 
                        key={day} 
                        className={`p-3 text-center font-medium rounded-lg ${
                          day === today 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted"
                        }`}
                      >
                        {day}
                        {day === today && <span className="block text-xs opacity-80">Today</span>}
                      </div>
                    ))}

                    {/* Time Slots */}
                    {timeSlots.map((slot, slotIndex) => (
                      <>
                        <div 
                          key={`time-${slotIndex}`} 
                          className="p-3 text-center text-sm font-medium text-muted-foreground bg-muted/50 rounded-lg"
                        >
                          {slot}
                        </div>
                        {days.map((day) => {
                          const subjectCode = timetableData[day][slotIndex];
                          const subject = subjects[subjectCode];
                          
                          if (!subject && !subjectCode) {
                            return (
                              <div key={`${day}-${slotIndex}`} className="p-2" />
                            );
                          }

                          return (
                            <div
                              key={`${day}-${slotIndex}`}
                              className={`p-2 rounded-lg border text-center ${subject?.color || "bg-muted"}`}
                            >
                              <p className="font-medium text-sm">{subject?.name}</p>
                              {subject?.teacher && (
                                <p className="text-xs opacity-75 mt-0.5">{subject.teacher}</p>
                              )}
                            </div>
                          );
                        })}
                      </>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card className="mt-4">
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-3">
                  {Object.entries(subjects)
                    .filter(([code]) => code !== "BREAK" && code !== "LUNCH")
                    .map(([code, subject]) => (
                      <div 
                        key={code} 
                        className={`px-3 py-1.5 rounded-lg text-sm ${subject.color}`}
                      >
                        {subject.name}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Today's Schedule */}
          <TabsContent value="today">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Today's Schedule - {today}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {timeSlots.map((slot, index) => {
                    const subjectCode = timetableData[today]?.[index];
                    const subject = subjects[subjectCode];
                    const currentHour = new Date().getHours();
                    const slotHour = parseInt(slot.split(":")[0]);
                    const isCurrentPeriod = currentHour === slotHour || (currentHour === slotHour + 12 && slotHour < 8);
                    
                    if (!subject) return null;

                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                          isCurrentPeriod 
                            ? "border-primary bg-primary/5 shadow-sm" 
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className={`w-16 text-center ${isCurrentPeriod ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                          <p className="text-sm">{slot.split(" - ")[0]}</p>
                          <p className="text-xs">to</p>
                          <p className="text-sm">{slot.split(" - ")[1]}</p>
                        </div>
                        <div className="w-px h-12 bg-border" />
                        <div className={`flex-1 px-4 py-2 rounded-lg ${subject.color}`}>
                          <p className="font-semibold">{subject.name}</p>
                          {subject.teacher && (
                            <p className="text-sm opacity-75">{subject.teacher}</p>
                          )}
                        </div>
                        {isCurrentPeriod && (
                          <Badge className="bg-primary">Now</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </UnifiedLayout>
  );
}
