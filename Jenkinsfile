pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
  }

  environment {
    IMAGE_TAG = "${env.BUILD_NUMBER}"
    AWS_REGION = 'ap-south-1'
    AWS_ACCOUNT_ID = '140311410153'
    ECR_REGISTRY = '140311410153.dkr.ecr.ap-south-1.amazonaws.com'
    BACKEND_IMAGE = "${ECR_REGISTRY}/polling-backend:${IMAGE_TAG}"
    FRONTEND_IMAGE = "${ECR_REGISTRY}/polling-frontend:${IMAGE_TAG}"
    TRIVY_SEVERITY = 'HIGH,CRITICAL'
    GITOPS_BRANCH = 'main'
    GITHUB_REPO = 'github.com/Harsha2318/polling-devops.git'
  }

  tools {
    jdk 'jdk17'
    nodejs 'node18'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Backend Build and Test') {
      steps {
        dir('backend') {
          sh 'mvn clean verify'
        }
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'backend/target/surefire-reports/*.xml'
        }
      }
    }

    stage('Frontend Build') {
      steps {
        dir('frontend') {
          sh 'npm ci'
          sh 'npm run build'
        }
      }
    }

    stage('SonarQube Analysis') {
      parallel {
        stage('Backend SonarQube') {
          steps {
            dir('backend') {
              withSonarQubeEnv('sonarqube-server') {
                sh '''
                  mvn sonar:sonar \
                    -Dsonar.projectKey=voting-backend \
                    -Dsonar.projectName=voting-backend
                '''
              }
            }
          }
        }
        stage('Frontend SonarQube') {
          steps {
            dir('frontend') {
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
        sh "docker build -t ${BACKEND_IMAGE} ./backend"
        sh "docker build -t ${FRONTEND_IMAGE} ./frontend"
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
        sh '''
          aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}
        '''
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
        withCredentials([usernamePassword(credentialsId: 'github-token', usernameVariable: 'GIT_USER', passwordVariable: 'GIT_TOKEN')]) {
          sh '''
            git config user.name "jenkins"
            git config user.email "jenkins@local"
            cd k8s
            kustomize edit set image voting-backend=${ECR_REGISTRY}/polling-backend:${IMAGE_TAG}
            kustomize edit set image voting-frontend=${ECR_REGISTRY}/polling-frontend:${IMAGE_TAG}
            cd ..
            git add k8s/kustomization.yml
            git diff --cached --quiet || git commit -m "Update GitOps image tags to ${IMAGE_TAG}"
            git remote set-url origin https://${GIT_USER}:${GIT_TOKEN}@${GITHUB_REPO}
            git push origin HEAD:${GITOPS_BRANCH}
          '''
        }
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
