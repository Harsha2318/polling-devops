pipeline {
  agent any

  parameters {
    booleanParam(name: 'ENABLE_SONAR', defaultValue: false, description: 'Run SonarQube analysis for backend and frontend')
    string(name: 'BACKEND_BRANCH', defaultValue: 'main', description: 'Backend repository branch to build')
    string(name: 'FRONTEND_BRANCH', defaultValue: 'main', description: 'Frontend repository branch to build')
    string(name: 'BACKEND_REPO_URL', defaultValue: 'https://github.com/Harsha2318/voting_app.git', description: 'Backend repository URL')
    string(name: 'FRONTEND_REPO_URL', defaultValue: 'https://github.com/Harsha2318/Polling_Application.git', description: 'Frontend repository URL')
    string(name: 'GITOPS_REPO', defaultValue: 'github.com/Harsha2318/polling-devops.git', description: 'GitOps repository host/path used for credentialed push')
    string(name: 'GITOPS_BRANCH', defaultValue: 'main', description: 'GitOps branch updated by Jenkins')
    string(name: 'AWS_REGION', defaultValue: 'ap-south-1', description: 'AWS region for ECR')
    string(name: 'AWS_ACCOUNT_ID', defaultValue: '140311410153', description: 'AWS account ID that owns the ECR repositories')
    string(name: 'BACKEND_ECR_REPO', defaultValue: 'polling-backend', description: 'Backend ECR repository name')
    string(name: 'FRONTEND_ECR_REPO', defaultValue: 'polling-frontend', description: 'Frontend ECR repository name')
    string(name: 'TRIVY_SEVERITY', defaultValue: 'HIGH,CRITICAL', description: 'Comma-separated Trivy severities that fail the build')
  }

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
  }

  stages {
    stage('Clean Workspace') {
      steps {
        deleteDir()
      }
    }

    stage('Checkout DevOps Repo') {
      steps {
        checkout scm
      }
    }

    stage('Initialize Pipeline Config') {
      steps {
        script {
          env.AWS_REGION = params.AWS_REGION.trim()
          env.AWS_ACCOUNT_ID = params.AWS_ACCOUNT_ID.trim()
          env.ECR_REGISTRY = "${env.AWS_ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com"
          env.BACKEND_REPO_URL = params.BACKEND_REPO_URL.trim()
          env.FRONTEND_REPO_URL = params.FRONTEND_REPO_URL.trim()
          env.GITOPS_REPO = params.GITOPS_REPO.trim()
          env.GITOPS_BRANCH = params.GITOPS_BRANCH.trim()
          env.BACKEND_ECR_REPO = params.BACKEND_ECR_REPO.trim()
          env.FRONTEND_ECR_REPO = params.FRONTEND_ECR_REPO.trim()
          env.TRIVY_SEVERITY = params.TRIVY_SEVERITY.trim()

          [
            'AWS_REGION',
            'AWS_ACCOUNT_ID',
            'BACKEND_REPO_URL',
            'FRONTEND_REPO_URL',
            'GITOPS_REPO',
            'GITOPS_BRANCH',
            'BACKEND_ECR_REPO',
            'FRONTEND_ECR_REPO',
            'TRIVY_SEVERITY'
          ].each { name ->
            if (!env[name]) {
              error "Required pipeline parameter ${name} is empty"
            }
          }

          echo "ECR registry: ${env.ECR_REGISTRY}"
          echo "GitOps target: ${env.GITOPS_REPO} (${env.GITOPS_BRANCH})"
        }
      }
    }

    stage('Validate DevOps Files') {
      steps {
        sh 'kubectl kustomize k8s > rendered-k8s.yml'
        dir('terraform') {
          sh 'terraform fmt -check -recursive'
          sh 'terraform init -backend=false'
          sh 'terraform validate'
        }
      }
    }

    stage('Clone App Repositories') {
      steps {
        dir('backend-src') {
          git branch: params.BACKEND_BRANCH, credentialsId: 'github-token', url: env.BACKEND_REPO_URL
        }
        dir('frontend-src') {
          git branch: params.FRONTEND_BRANCH, credentialsId: 'github-token', url: env.FRONTEND_REPO_URL
        }
        script {
          env.BACKEND_COMMIT = sh(script: 'git -C backend-src rev-parse --short=8 HEAD', returnStdout: true).trim()
          env.FRONTEND_COMMIT = sh(script: 'git -C frontend-src rev-parse --short=8 HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.BACKEND_COMMIT}-${env.FRONTEND_COMMIT}"
          env.BACKEND_IMAGE = "${env.ECR_REGISTRY}/${env.BACKEND_ECR_REPO}:${env.IMAGE_TAG}"
          env.FRONTEND_IMAGE = "${env.ECR_REGISTRY}/${env.FRONTEND_ECR_REPO}:${env.IMAGE_TAG}"

          echo "Backend image: ${env.BACKEND_IMAGE}"
          echo "Frontend image: ${env.FRONTEND_IMAGE}"
        }
      }
    }

    stage('Backend Build and Test') {
      steps {
        dir('backend-src') {
          sh 'mvn -B clean verify'
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
      when {
        expression { params.ENABLE_SONAR }
      }
      steps {
        withSonarQubeEnv('sonarqube-server') {
          dir('backend-src') {
            sh '''
              mvn -B sonar:sonar \
                -Dsonar.projectKey=voting-backend \
                -Dsonar.projectName=voting-backend
            '''
          }
          dir('frontend-src') {
            sh '''
              npx --yes sonar-scanner \
                -Dsonar.projectKey=voting-frontend \
                -Dsonar.projectName=voting-frontend \
                -Dsonar.sources=src
            '''
          }
        }
      }
    }

    stage('Build Docker Images') {
      steps {
        sh '''
          docker build -t ${BACKEND_IMAGE} ./backend-src
          docker build -t ${FRONTEND_IMAGE} ./frontend-src
        '''
      }
    }

    stage('Trivy Image Scan') {
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
        sh 'aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}'
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
            git remote set-url origin https://${GIT_USER}:${GIT_TOKEN}@${GITOPS_REPO}
            git fetch origin ${GITOPS_BRANCH}
            git checkout -B ${GITOPS_BRANCH} origin/${GITOPS_BRANCH}

            git config user.name "jenkins"
            git config user.email "jenkins@local"

            cd k8s
            kustomize edit set image voting-backend=${BACKEND_IMAGE}
            kustomize edit set image voting-frontend=${FRONTEND_IMAGE}
            cd ..

            kubectl kustomize k8s > rendered-k8s.yml

            git add k8s/kustomization.yml
            if git diff --cached --quiet; then
              echo "k8s/kustomization.yml already points at ${IMAGE_TAG}; no GitOps commit needed."
            else
              git commit -m "Update app images to ${IMAGE_TAG}"
              git pull --rebase origin ${GITOPS_BRANCH}
              git push origin HEAD:${GITOPS_BRANCH}
            fi
          '''
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts allowEmptyArchive: true, artifacts: 'rendered-k8s.yml,trivy-report.txt'
    }
    success {
      echo 'CI completed. Argo CD will deploy the updated GitOps manifests from polling-devops.'
    }
    failure {
      echo 'CI/CD pipeline failed. Check the first failed stage and keep deployment changes flowing through Argo CD.'
    }
  }
}
