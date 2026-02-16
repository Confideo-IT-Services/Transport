import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Save, Zap } from 'lucide-react';
import { studentsApi } from '@/lib/api';
import { toast } from 'sonner';

interface QuickStudent {
  name: string;
  parentPhone: string;
  parentName?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
}

export function QuickEntryDialog({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [students, setStudents] = useState<QuickStudent[]>([
    { name: '', parentPhone: '', parentName: '', dateOfBirth: '', gender: undefined }
  ]);
  const [saving, setSaving] = useState(false);
  const nameInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first name input when dialog opens
  useEffect(() => {
    if (open && nameInputRefs.current[0]) {
      setTimeout(() => {
        nameInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStudents([{ name: '', parentPhone: '', parentName: '', dateOfBirth: '', gender: undefined }]);
    }
  }, [open]);

  const addStudent = () => {
    setStudents([...students, { name: '', parentPhone: '', parentName: '', dateOfBirth: '', gender: undefined }]);
    // Focus on new student's name field
    setTimeout(() => {
      const nextIndex = students.length;
      if (nameInputRefs.current[nextIndex]) {
        nameInputRefs.current[nextIndex]?.focus();
      }
    }, 0);
  };

  const removeStudent = (index: number) => {
    if (students.length > 1) {
      setStudents(students.filter((_, i) => i !== index));
      // Clean up refs
      nameInputRefs.current = nameInputRefs.current.filter((_, i) => i !== index);
    }
  };

  const updateStudent = (index: number, field: keyof QuickStudent, value: string) => {
    const updated = [...students];
    updated[index] = { ...updated[index], [field]: value };
    setStudents(updated);
  };

  const handleKeyPress = (e: React.KeyboardEvent, index: number) => {
    // Enter key: Move to next field or add new student
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const currentStudent = students[index];
      
      // If name and phone filled, add next student
      if (currentStudent.name.trim() && currentStudent.parentPhone.trim()) {
        addStudent();
      }
    }
  };

  const handleSave = async () => {
    // Filter out empty students
    const validStudents = students.filter(s => s.name.trim() && s.parentPhone.trim());
    
    if (validStudents.length === 0) {
      toast.error('Please enter at least one student with name and phone');
      return;
    }

    setSaving(true);
    try {
      const result = await studentsApi.quickEntry(validStudents);
      
      if (result.errors && result.errors.length > 0) {
        toast.warning(`Created ${result.created} student(s), ${result.failed} failed`);
      } else {
        toast.success(`✅ ${result.created} student(s) added to pending submissions`);
      }
      
      setStudents([{ name: '', parentPhone: '', parentName: '', dateOfBirth: '', gender: undefined }]);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save students');
    } finally {
      setSaving(false);
    }
  };

  const validCount = students.filter(s => s.name.trim() && s.parentPhone.trim()).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold">Quick Entry - Admission Rush</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Enter minimal details. Class assignment will be done during approval.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {students.map((student, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Student #{index + 1}
                  </span>
                  {students.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStudent(index)}
                      className="h-6 w-6"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Student Name *</Label>
                    <Input
                      ref={(el) => (nameInputRefs.current[index] = el)}
                      value={student.name}
                      onChange={(e) => updateStudent(index, 'name', e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      placeholder="Enter name"
                    />
                  </div>
                  <div>
                    <Label>Parent Phone *</Label>
                    <Input
                      value={student.parentPhone}
                      onChange={(e) => updateStudent(index, 'parentPhone', e.target.value)}
                      placeholder="9876543210"
                      type="tel"
                    />
                  </div>
                  <div>
                    <Label>Parent Name</Label>
                    <Input
                      value={student.parentName || ''}
                      onChange={(e) => updateStudent(index, 'parentName', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={student.dateOfBirth || ''}
                      onChange={(e) => updateStudent(index, 'dateOfBirth', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Gender</Label>
                    <select
                      value={student.gender || ''}
                      onChange={(e) => updateStudent(index, 'gender', e.target.value as any)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="">Select (Optional)</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={addStudent}
            className="mt-4 w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Student
          </Button>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex items-center justify-between bg-muted/30">
          <p className="text-sm text-muted-foreground">
            {validCount} student(s) ready to save
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || validCount === 0}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : `Save ${validCount} Student(s)`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}







