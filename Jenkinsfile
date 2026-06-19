pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
  }

  environment {
    BACKEND_REPO = 'https://github.com/Harsha2318/voting_app.git'
    FRONTEND_REPO = 'https://github.com/Harsha2318/Polling_Application.git'
    IMAGE_TAG = "${env.BUILD_NUMBER}"
    AWS_REGION = 'ap-south-1'
    ECR_REGISTRY = '140311410153.dkr.ecr.ap-south-1.amazonaws.com'
    BACKEND_IMAGE = "${ECR_REGISTRY}/polling-backend:${IMAGE_TAG}"
    FRONTEND_IMAGE = "${ECR_REGISTRY}/polling-frontend:${IMAGE_TAG}"
    TRIVY_SEVERITY = 'HIGH,CRITICAL'
    GITOPS_BRANCH = 'main'
  }

  tools {
    jdk 'jdk17'
    nodejs 'node18'
  }

  stages {
    stage('Checkout DevOps Repo') {
      steps {
        checkout scm
      }
    }

    stage('Checkout Application Repositories') {
      steps {
        dir('backend-src') {
          git branch: 'main', url: env.BACKEND_REPO
        }
        dir('frontend-src') {
          git branch: 'main', url: env.FRONTEND_REPO
        }
      }
    }

    stage('Backend Build and Test') {
      steps {
        dir('backend-src') {
          sh './mvnw clean verify'
        }
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'backend-src/target/surefire-reports/*.xml'
        }
      }
    }

    stage('Frontend Build') {
      steps {
        dir('frontend-src') {
          sh 'npm ci'
          sh 'npm run build'
        }
      }
    }

    stage('SonarQube Analysis') {
      parallel {
        stage('Backend SonarQube') {
          steps {
            dir('backend-src') {
              withSonarQubeEnv('sonarqube-server') {
                sh '''
                  ./mvnw sonar:sonar \
                    -Dsonar.projectKey=voting-backend \
                    -Dsonar.projectName=voting-backend
                '''
              }
            }
          }
        }
        stage('Frontend SonarQube') {
          steps {
            dir('frontend-src') {
              withSonarQubeEnv('sonarqube-server') {
                sh '''
                  npx sonar-scanner \
                    -Dsonar.projectKey=voting-frontend \
                    -Dsonar.projectName=voting-frontend \
                    -Dsonar.sources=.
                '''
              }
            }
          }
        }
      }
    }

    stage('Quality Gate') {
      steps {
        timeout(time: 10, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('Build Docker Images') {
      steps {
        dir('backend-src') {
          sh "docker build -t ${BACKEND_IMAGE} ."
        }
        dir('frontend-src') {
          sh "docker build -t ${FRONTEND_IMAGE} ."
        }
      }
    }

    stage('Trivy Scan') {
      steps {
        sh '''
          trivy image --severity ${TRIVY_SEVERITY} --no-progress ${BACKEND_IMAGE} | tee trivy-report.txt
          trivy image --severity ${TRIVY_SEVERITY} --no-progress ${FRONTEND_IMAGE} | tee -a trivy-report.txt
          trivy image --severity ${TRIVY_SEVERITY} --exit-code 1 --no-progress ${BACKEND_IMAGE}
          trivy image --severity ${TRIVY_SEVERITY} --exit-code 1 --no-progress ${FRONTEND_IMAGE}
        '''
      }
    }

    stage('Login To ECR') {
      steps {
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-ecr-creds']]) {
          sh '''
            aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}
          '''
        }
      }
    }

    stage('Push Images To ECR') {
      steps {
        sh '''
          docker push ${BACKEND_IMAGE}
          docker push ${FRONTEND_IMAGE}
        '''
      }
    }

    stage('Update GitOps Manifests') {
      steps {
        sh '''
          git config user.name "jenkins"
          git config user.email "jenkins@local"
          python - <<'PY'
from pathlib import Path
path = Path("k8s/kustomization.yml")
text = path.read_text()
text = text.replace("140311410153.dkr.ecr.ap-south-1.amazonaws.com/polling-backend", "${ECR_REGISTRY}/polling-backend")
text = text.replace("140311410153.dkr.ecr.ap-south-1.amazonaws.com/polling-frontend", "${ECR_REGISTRY}/polling-frontend")
lines = []
count = 0
for line in text.splitlines():
    if line.strip().startswith("newTag:"):
        count += 1
        lines.append(f"    newTag: ${IMAGE_TAG}")
    else:
        lines.append(line)
path.write_text("\\n".join(lines) + "\\n")
PY
          git add k8s/kustomization.yml
          git diff --cached --quiet || git commit -m "Update GitOps image tags to ${IMAGE_TAG}"
          git push origin HEAD:${GITOPS_BRANCH}
        '''
      }
    }
  }

  post {
    always {
      archiveArtifacts allowEmptyArchive: true, artifacts: 'trivy-report.txt'
    }
    success {
      echo 'Pipeline completed successfully.'
    }
    failure {
      echo 'Pipeline failed. Review the stage logs for the first blocking error.'
    }
  }
}
